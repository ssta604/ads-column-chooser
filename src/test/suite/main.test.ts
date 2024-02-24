// import * as vscode from 'vscode';
// import * as azdata from 'azdata';
// import { generateQuickPickItems, getTableSchema, parseSelectQuery, removeBrackets } from '../../main';
// import { jest } from '@jest/globals';
// import { Select } from 'node-sql-parser';

// jest.mock('vscode');
// jest.mock('azdata');

// describe('generateQuickPickItems', () => {
//   it('should return an array of QuickPickItems', async () => {

//     const tableInformation = [
//       { columnName: 'column1', dataType: 'int', description: 'Column 1' },
//       { columnName: 'column2', dataType: 'varchar', description: 'Column 2' },
//     ];

//     const expectedQuickPickItems = [
//       { label: 'column1', description: 'int | Column 1', picked: true, column: { expr: { type: 'column_ref', column: 'column1' }, as: 'alias1' } },
//       { label: 'column2', description: 'varchar | Column 2', picked: true, column: { expr: { type: 'column_ref', column: 'column2' }, as: 'alias2' } },
//     ];

//     jest.spyOn(azdata.connection, 'getCurrentConnection').mockResolvedValue({});
//     jest.spyOn(azdata.dataprotocol, 'getProvider').mockResolvedValue({});
//     jest.spyOn(azdata.connection, 'getUriForConnection').mockResolvedValue('uri');
//     jest.spyOn(vscode.window, 'showErrorMessage');
//     jest.spyOn(vscode.window, 'createQuickPick').mockReturnValue({
//       items: [],
//       canSelectMany: true,
//       selectedItems: [],
//       title: '',
//       placeholder: '',
//       onDidAccept: jest.fn(),
//       show: jest.fn(),
//       hide: jest.fn(),
//     } as any);

//     const selectAstIn: Select = {
//       with: null,
//       type: 'select',
//       options: [],
//       distinct: null,
//       columns: [
//         { expr: { type: 'column_ref', column: 'column1' }, as: 'alias1' },
//         { expr: { type: 'column_ref', column: 'column2' }, as: 'alias2' },
//       ],
//       from: [{ table: 'table1' }],
//       where: null,
//       groupby: null,
//       having: null,
//       orderby: null,
//       limit: null
//     };

//     jest.spyOn(azdata.dataprotocol.getProvider('MSSQL', azdata.DataProviderType.QueryProvider), 'runQueryAndReturn').mockResolvedValue({
//       rows: tableInformation.map((info) => [
//         { displayValue: info.columnName },
//         { displayValue: info.dataType },
//         { displayValue: info.description },
//       ]),
//     });

//     const result = await generateQuickPickItems(selectAstIn);

//     expect(result).toEqual(expectedQuickPickItems);
//     expect(azdata.connection.getCurrentConnection).toHaveBeenCalled();
//     expect(azdata.dataprotocol.getProvider).toHaveBeenCalledWith('MSSQL', azdata.DataProviderType.QueryProvider);
//     expect(azdata.connection.getUriForConnection).toHaveBeenCalled();
//     expect(azdata.dataprotocol.getProvider('MSSQL', azdata.DataProviderType.QueryProvider).runQueryAndReturn).toHaveBeenCalledWith(
//       'uri',
//       expect.any(String)
//     );
//     expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
//   });

//   it('should show an error message when no connection is found', async () => {
//     const selectAstIn = {
//       columns: [{ expr: { type: 'column_ref', column: 'column1' }, as: 'alias1' }],
//       from: [{ table: 'table1' }],
//     };

//     jest.spyOn(azdata.connection, 'getCurrentConnection').mockResolvedValue(undefined);
//     jest.spyOn(vscode.window, 'showErrorMessage');

//     await generateQuickPickItems(selectAstIn);

//     expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No connection found! Please connect to a server first.');
//   });
// });

// describe('getTableSchema', () => {
//   it('should return table schema information', async () => {
//     const database = 'database1';
//     const schema = 'schema1';
//     const table = 'table1';

//     const connection = { connectionId: 'connectionId' };
//     const ownerUri = 'ownerUri';
//     const tableInfoSql = `SELECT sc.name AS ColumnName, sty.name + CASE 
//                                 WHEN sc.max_length IS NOT NULL AND 
//                                     THEN '(' + CAST(IIF(sty.user_type_id IN(99,231,239) ,sc.max_length / 2, sc.max_length ) AS VARCHAR) + ')' 
//                                 WHEN sc.[precision] IS NOT NULL 
//                                     THEN '(' + CAST(sc.[precision] AS VARCHAR) + 
//                                     CASE 
//                                         WHEN sc.scale IS NOT NULL 
//                                         THEN ',' + CAST(sc.scale AS VARCHAR) ELSE '' 
//                                         END + ')' 
//                                     ELSE '' 
//                                 END AS DataType,
//                                 sep.[value] as Description
//                         FROM sys.tables AS st
//                             INNER JOIN sys.schemas AS ss ON st.schema_id = ss.schema_id
//                             INNER JOIN sys.columns AS sc ON st.object_id = sc.object_id
//                             INNER JOIN sys.types AS sty ON sc.user_type_id = sty.user_type_id
//                             LEFT JOIN sys.extended_properties as sep ON sc.object_id =sep.major_id AND sc.column_id = sep.minor_id AND sep.name = 'MS_Description'
//                         WHERE st.name = 'table1' AND ss.name = 'schema1'
//                         ORDER BY sc.column_id;`;

//     const queryResults = {
//       rows: [
//         [{ displayValue: 'column1' }, { displayValue: 'int' }, { displayValue: 'Column 1' }],
//         [{ displayValue: 'column2' }, { displayValue: 'varchar' }, { displayValue: 'Column 2' }],
//       ],
//     };

//     jest.spyOn(azdata.connection, 'getCurrentConnection').mockResolvedValue(connection);
//     jest.spyOn(azdata.connection, 'getUriForConnection').mockResolvedValue(ownerUri);
//     jest.spyOn(azdata.dataprotocol, 'getProvider').mockResolvedValue({});
//     jest.spyOn(azdata.dataprotocol.getProvider('MSSQL', azdata.DataProviderType.QueryProvider), 'runQueryAndReturn').mockResolvedValue(queryResults);

//     const result = await getTableSchema(database, schema, table);

//     expect(result).toEqual([
//       { columnName: 'column1', dataType: 'int', description: 'Column 1' },
//       { columnName: 'column2', dataType: 'varchar', description: 'Column 2' },
//     ]);
//     expect(azdata.connection.getCurrentConnection).toHaveBeenCalled();
//     expect(azdata.connection.getUriForConnection).toHaveBeenCalledWith(connection.connectionId);
//     expect(azdata.dataprotocol.getProvider).toHaveBeenCalledWith('MSSQL', azdata.DataProviderType.QueryProvider);
//     expect(azdata.dataprotocol.getProvider('MSSQL', azdata.DataProviderType.QueryProvider).runQueryAndReturn).toHaveBeenCalledWith(
//       ownerUri,
//       tableInfoSql
//     );
//     expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
//   });

//   it('should show an error message when no connection is found', async () => {
//     const database = 'database1';
//     const schema = 'schema1';
//     const table = 'table1';

//     jest.spyOn(azdata.connection, 'getCurrentConnection').mockResolvedValue(undefined);
//     jest.spyOn(vscode.window, 'showErrorMessage');

//     await getTableSchema(database, schema, table);

//     expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('No connection found! Please connect to a server first.');
//   });
// });

// describe('parseSelectQuery', () => {
//   it('should return the parsed Select AST', () => {
//     const query = 'SELECT column1, column2 FROM table1';

//     const result = parseSelectQuery(query);

//     expect(result).toEqual({
//       type: 'select',
//       columns: [
//         { expr: { type: 'column_ref', column: 'column1' }, as: null },
//         { expr: { type: 'column_ref', column: 'column2' }, as: null },
//       ],
//       from: [{ table: 'table1' }],
//     });
//   });

//   it('should return undefined for non-SELECT queries', () => {
//     const query = 'INSERT INTO table1 (column1) VALUES (1)';

//     const result = parseSelectQuery(query);

//     expect(result).toBeUndefined();
//   });
// });

// describe('removeBrackets', () => {
//   it('should remove brackets from the input text', () => {
//     const text = '[column1]';

//     const result = removeBrackets(text);

//     expect(result).toBe('column1');
//   });

//   it('should remove multiple brackets from the input text', () => {
//     const text = '[[column1]]';

//     const result = removeBrackets(text);

//     expect(result).toBe('column1');
//   });

//   it('should not remove brackets from the input text if they are not at the beginning and end', () => {
//     const text = 'column1[column2]column3';

//     const result = removeBrackets(text);

//     expect(result).toBe('column1[column2]column3');
//   });

//   it('should return undefined if the input text is undefined', () => {
//     const text = undefined;

//     const result = removeBrackets(text);

//     expect(result).toBeUndefined();
//   });
// });