'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { QuickPickItem } from 'vscode';
import { Parser, Select, From, Column, ColumnRef, AST, OrderBy } from 'node-sql-parser/build/transactsql';
import { format } from 'sql-formatter';

function activate(context: vscode.ExtensionContext) {
    let quickPickItems: QuickPickItem[] = [];
    let qualififyColumns = false;
    let selectAstIn: Select | undefined;

    context.subscriptions.push(vscode.commands.registerCommand('column-chooser.action.show', async () => {
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            await vscode.window.showErrorMessage('No active editor found! Please open a file first.');
            return;
        }

        let editorText = editor.document.getText();

        selectAstIn = parseQuery(editorText) as Select;

        if (!selectAstIn) {
            await vscode.window.showErrorMessage('Invalid SQL statement! Currently only SELECT statements are supported.');
            return;
        }

        qualififyColumns = selectAstIn.from && selectAstIn.from.length > 1
            || (selectAstIn.columns as Column[]).some(c => c.expr.type === 'column_ref' && c.expr.table !== null);

        // Add columns to the quick pick list from the query
        quickPickItems = (selectAstIn.columns as Column[])
            .filter(c => !(c.expr.type === 'column_ref' && c.expr.column === '*'))
            .map((c) => {
                const parser = new Parser();
                const label = removeBrackets(parser.exprToSQL(c.expr));

                return {
                    label: label,
                    description: c.as || '',
                    //buttons: [editButton],
                    picked: true,
                    column: c
                } as QuickPickItem
            });

        for (const f of selectAstIn.from as From[]) {
            try {
                const database = f.db ? f.db + '.' : '';
                const schema = (f as any).schema ? (f as any).tableSchema + '.' : '';
                const tableName = qualififyColumns ? (f.as ?? f.table) + '.' : '';
                const tableSchema = await getTableSchema(database, schema, f.table);
                tableSchema?.forEach(t => {
                    const label = `${database}${schema}${tableName}${t.columnName}`;
                    let idx = quickPickItems.findIndex(i => i.label.toLowerCase() === label.toLowerCase());
                    if (idx == -1) {
                        const column = { as: null, expr: { type: "column_ref", table: f.as ?? f.table, column: t.columnName } } as Column;
                        quickPickItems.push({ label: label, description: t.dataType || '', picked: false, column: column } as QuickPickItem);
                    } else {
                        quickPickItems[idx].description = t.dataType || '';
                    }
                });
            } catch (error) {
                console.error(`Error retrieving table schema for ${f.table}: ${error}.`);
            }
        }

        var quickPick = vscode.window.createQuickPick();
        quickPick.items = quickPickItems;
        quickPick.canSelectMany = true;
        quickPick.selectedItems = quickPickItems.filter(i => i.picked);
        quickPick.title = 'Column Chooser';
        quickPick.placeholder = 'Pick a Columns...';
        quickPick.onDidAccept(() => {
            // Build AST based on the selected columns
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

            if (hasOrderBy) {
                astColumnsOut.filter(c => c.expr.type === 'column_ref').map(c => {
                    // Add selected columns to the AST order by if not already in the order by clause
                    let idx = astSelect.orderby!.findIndex(o => (o.expr as ColumnRef).column === (c.expr as ColumnRef).column);
                    if (idx === -1) {
                        astSelect.orderby!.push({ expr: c.expr, type: 'ASC' } as OrderBy);
                    }

                    // Remove columns from the AST order by that are not selected
                    astSelect.orderby = astSelect.orderby!.filter(o => {
                        return astColumnsOut.some(col => (o.expr as ColumnRef).column === (col.expr as ColumnRef).column);
                    });
                });
            }

            // Convert the AST back to a query  
            let newQuery = parser.sqlify(ast);

            newQuery = removeBrackets(newQuery);
            // Format the query
            newQuery = format(newQuery, { language: 'tsql', keywordCase: 'upper' });

            editor!.edit(editBuilder => {
                editBuilder.replace(new vscode.Range(new vscode.Position(0, 0), editor!.document.lineAt(editor!.document.lineCount - 1).range.end), newQuery);
            });

            quickPick.hide();
        });

        quickPick.show();

        return;
    }));
}

async function getTableSchema(database: string, schema: string, table: string) {
    let connection = await azdata.connection.getCurrentConnection();
    if (!connection) {
        await vscode.window.showErrorMessage('No connection found! Please connect to a server first.');
        return;
    }

    let schemaClause = schema !== '' ? "AND TABLE_SCHEMA = '" + schema + "'" : '';

    const tableInfoSql = `SELECT COLUMN_NAME, DATA_TYPE + CASE WHEN CHARACTER_MAXIMUM_LENGTH IS NOT NULL THEN '(' + CAST(CHARACTER_MAXIMUM_LENGTH AS VARCHAR) + ')' 
                                                               WHEN NUMERIC_PRECISION IS NOT NULL THEN '(' + CAST(NUMERIC_PRECISION AS VARCHAR) + 
                                                               CASE WHEN NUMERIC_SCALE IS NOT NULL THEN ',' + CAST(NUMERIC_SCALE AS VARCHAR) ELSE '' END + ')' 
                                                               ELSE '' END AS DATA_TYPE
                              FROM ${database}INFORMATION_SCHEMA.COLUMNS 
                              WHERE TABLE_NAME = '${table}' ${schemaClause}
                              ORDER BY ORDINAL_POSITION`;

    const provider = await azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
    const ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
    const queryResults = await provider.runQueryAndReturn(ownerUri, tableInfoSql);
    return queryResults.rows.map((row: any) => ({ columnName: row[0].displayValue, dataType: row[1].displayValue }));
}

function parseQuery(query: string): AST | undefined {
    const parser = new Parser();
    const parseResults = parser.astify(query);

    if (Array.isArray(parseResults)) {
        // TODO: handle multiple statements
        return;
    }

    if (parseResults.type !== 'select') {
        return;
    }

    return parseResults as AST;
}

function removeBrackets(text: string) {
    return text?.replace(/\[+([^\]| ]*)\]/gm, '$1');
}

function deactivate() {

}


export { activate, deactivate };