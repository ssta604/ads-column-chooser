'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QuickPickItem } from 'vscode';
import { Parser, Select, From, Column, ColumnRef, AST, OrderBy } from 'node-sql-parser/build/transactsql';
import { format } from 'sql-formatter';

async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand('column-chooser.action.show', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor found! Please open a file first.');
            return;
        }

        const editorText = editor.document.getText();
        const selectAstIn = parseSelectQuery(editorText);

        if (!selectAstIn) {
            vscode.window.showErrorMessage('Invalid SQL statement! Currently only SELECT statements are supported.');
            return;
        }

        const quickPickItems = await generateQuickPickItems(selectAstIn);
        const quickPick = createQuickPick(quickPickItems, editorText);

        quickPick.show();
    }));
}

async function generateQuickPickItems(selectAstIn: Select): Promise<QuickPickItem[]> {
    const qualififyColumns = selectAstIn.from && selectAstIn.from.length > 1
        || (selectAstIn.columns as Column[]).some(c => c.expr.type === 'column_ref' && c.expr.table !== null);

    const quickPickItems: QuickPickItem[] = (selectAstIn.columns as Column[])
        .filter(c => !(c.expr.type === 'column_ref' && c.expr.column === '*'))
        .map((c) => {
            const label = removeBrackets(new Parser().exprToSQL(c.expr));
            return {
                label: label,
                description: c.as || '',
                picked: true,
                column: c
            } as QuickPickItem;
        });

    for (const fromTable of selectAstIn.from as From[]) {
        try {
            const database = fromTable.db ? fromTable.db + '.' : '';

            const schema = (fromTable as any).schema ? (fromTable as any).tableSchema + '.' : '';
            const tableName = qualififyColumns ? (fromTable.as ?? fromTable.table) + '.' : '';
            const tableInformation = await getTableSchema(database, schema, fromTable.table);

            tableInformation?.forEach(t => {
                const label = `${database}${schema}${tableName}${t.columnName}`;
                const existingItemIndex = quickPickItems.findIndex(i => i.label.toLowerCase() === label.toLowerCase());

                if (existingItemIndex === -1) {
                    const column = { as: null, expr: { type: "column_ref", table: fromTable.as ?? fromTable.table, column: t.columnName } } as Column;
                    const description = t.dataType + (t.description ? ' | ' + t.description : '');
                    quickPickItems.push({ label: label, description: description || '', picked: false, column: column } as QuickPickItem);
                } else {
                    // Update the description of the existing item from the table information
                    const qp = quickPickItems[existingItemIndex] as QuickPickItem & { column: Column };
                    const description = (qp.column.as ? ' as ' + qp.column.as + ' ' : '') + t.dataType + (t.description ? ' | ' + t.description : '');
                    qp.description = description;
                }
            });
        } catch (error) {
            console.error(`Error retrieving table schema for ${fromTable.table}: ${error}.`);
        }
    }

    return quickPickItems;
}


async function getTableSchema(database: string, schema: string, table: string) {
    const connection = await azdata.connection.getCurrentConnection();
    if (!connection) {
        vscode.window.showErrorMessage('No connection found! Please connect to a server first.');
        return;
    }

    const schemaClause = schema !== '' ? `AND ss.name = '${schema}'` : '';

    const tableInfoSql = `SELECT sc.name AS ColumnName, 
                                sty.name + CASE 
                                WHEN sc.max_length IS NOT NULL
                                    THEN '(' + CAST(IIF(sty.user_type_id IN(99,231,239) ,sc.max_length / 2, sc.max_length ) AS VARCHAR) + ')' 
                                WHEN sc.[precision] IS NOT NULL 
                                    THEN '(' + CAST(sc.[precision] AS VARCHAR) + 
                                    CASE 
                                        WHEN sc.scale IS NOT NULL 
                                        THEN ',' + CAST(sc.scale AS VARCHAR) ELSE '' 
                                        END + ')' 
                                    ELSE '' 
                                END AS DataType,
                                sep.[value] as Description
                        FROM sys.tables AS st
                            INNER JOIN sys.schemas AS ss ON st.schema_id = ss.schema_id
                            INNER JOIN sys.columns AS sc ON st.object_id = sc.object_id
                            INNER JOIN sys.types AS sty ON sc.user_type_id = sty.user_type_id
                            LEFT JOIN sys.extended_properties as sep ON sc.object_id =sep.major_id AND sc.column_id = sep.minor_id AND sep.name = 'MS_Description'
                        WHERE st.name = '${table}' ${schemaClause}
                        ORDER BY sc.column_id;`;

    const provider = await azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
    const ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
    const queryResults = await provider.runQueryAndReturn(ownerUri, tableInfoSql);

    if (!queryResults || !queryResults.rows || queryResults.rows.length === 0) {
        vscode.window.showErrorMessage('Error retrieving table schema!');
        return;
    }

    return queryResults.rows.map((row: azdata.DbCellValue[]) => ({ columnName: row[0].displayValue, dataType: row[1].displayValue, description: row[2].isNull ? '' : row[2].displayValue }));
}

function parseSelectQuery(query: string): Select | undefined {
    const parser = new Parser();
    const parseResults = parser.astify(query);

    if (Array.isArray(parseResults)) {
        return;
    }

    if (parseResults.type !== 'select') {
        return;
    }

    return parseResults as Select;
}

function removeBrackets(text: string) {
    return text?.replace(/\[+([^\]| ]*)\]/gm, '$1');
}

function createQuickPick(items: QuickPickItem[], editorText: string): vscode.QuickPick<QuickPickItem> {
    const quickPick = vscode.window.createQuickPick();
    quickPick.items = items;
    quickPick.canSelectMany = true;
    quickPick.selectedItems = items.filter(i => i.picked);
    quickPick.title = 'Column Chooser';
    quickPick.placeholder = 'Pick a Columns...';

    quickPick.onDidAccept(() => {
        updateEditor(quickPick, editorText);
        quickPick.hide();
    });

    return quickPick;
}

function updateEditor(quickPick: vscode.QuickPick<QuickPickItem>, editorText: string) {
    const parser = new Parser();
    const ast = parser.astify(editorText);
    const astSelect = ast as Select;
    const astColumnsOut = astSelect.columns as Column[];
    const hasAggrate = astColumnsOut.some(c => c.expr.type === 'aggr_func');
    const hasOrderBy = astSelect.orderby && astSelect.orderby.length > 0;

    // Remove all columns from the AST
    astColumnsOut.splice(0, astColumnsOut.length);

    // Add selected columns to the AST
    quickPick.selectedItems.forEach(qpi => {
        astColumnsOut.push((qpi as QuickPickItem & { column: Column }).column);
    });

    // Add group by clause if there are aggregate function(s) in the select clause
    astSelect.groupby = [];
    if (hasAggrate) {
        astColumnsOut.filter(c => c.expr.type == 'column_ref').map(c => {
            astSelect.groupby!.push(c.expr as ColumnRef);
        });
    }

    let newQuery = parser.sqlify(ast);
    newQuery = removeBrackets(newQuery);
    newQuery = format(newQuery, { language: 'transactsql', keywordCase: 'upper' });

    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.edit(editBuilder => {
            editBuilder.replace(new vscode.Range(new vscode.Position(0, 0), editor.document.lineAt(editor.document.lineCount - 1).range.end), newQuery);
        });
    }
}

function deactivate() { }

export { activate, deactivate };
