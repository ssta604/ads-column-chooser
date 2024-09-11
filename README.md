# Azure Data Studio Column Chooser Extension
The Column Chooser extension for Azure Data Studio allows users to easily select and customize columns in SQL SELECT statements.

## Features
- Displays a list of available columns in a SQL SELECT statement.
- Supports multi-column selection.
- Retrieves column information from the connected database, including column names and data types.
- Provides the option to qualify columns with their respective table or schema names.
- Automatically formats the modified SQL query for better readability.
- Support for T-SQL with other databases to come.
- Shows column description in column picker when *MS_Description* available.

## Installation
To install the Column Chooser extension, follow these steps:
1. Open Azure Data Studio.
2. Go to the Extensions view by clicking on the square icon on the sidebar or by pressing `Ctrl+Shift+X`.
3. Search for "Column Chooser".
4. Click on the "Install" button next to the Column Chooser extension.

To install a `.vsix` (VISX) extension file in Azure Data Studio, you can follow these steps:
1. **Download the VISX File:**
   Obtain the `.vsix` extension file either from the extension's official website, a download *todo: here*, or a source like the Azure Data Studio Marketplace.

2. **Open Azure Data Studio:**
   Launch Azure Data Studio on your computer.

3. **Access Extensions View:**
   - Click on the "Extensions" icon on the Activity Bar on the side of the window (it looks like four squares).
   - Alternatively, press `Ctrl+Shift+X` (Windows/Linux) or `Cmd+Shift+X` (Mac) to open the Extensions view directly.

4. **Install VISX:**
   - Once the Extensions view is open, click on the ellipsis (three dots) to open the Extensions menu.
   - You will see options like "Check for Extenting Updates", "Auto Update Extensions", "Install from VISX", etc.
   - Choose "Install from VISX..." from the menu.
   - Alternativly the "Install from VISX..." may be found on the File menu.
   - Locate the `.vsix` file on your computer in the file picker dialog that appears, then select and open it.

5. **Follow the Installation Process:**
   - Azure Data Studio will start installing the extension.
   - You may be prompted to confirm that you want to install the extension. Click "Install" to proceed.

6. **Restart Azure Data Studio (if required):**
   - In some cases, Azure Data Studio may prompt you to restart the editor to complete the installation. If prompted, click "Restart Now" to restart the editor.

7. **Verify Installation:**
   - After restarting, the extension should be installed and ready to use.
   - You can verify the installation by checking if the extension appears in the list of installed extensions in the Extensions view.

That's it! You have successfully installed a VISX extension file in Azure Data Studio. You can now start using the features provided by the extension.

## Usage
1. Open a SQL file in Azure Data Studio.
2. Enter a SELECT statement into the editor.
3. Press `Ctrl+Shift+P` or `F1` to open the command palette.
4. Type "Column Chooser" and select the command.
5. Alterativly use the mapped keyboard `Ctrl+Alt+C` (PC) `Cmd+Opt+C` (Mac).
6. A list of available columns will be displayed in a quick pick menu.
7. Select the desired columns by checking the boxes next to their names.
8. Press `Enter` to confirm your selection or `Escape` to cancel.
9. The modified SQL query with the selected columns will replace the original query in the editor.

## Requirements
- Azure Data Studio

## Contributing
Contributions to the Column Chooser extension are welcome! If you encounter any bugs or have suggestions for improvements, please feel free to [create an issue](https://github.com/ssta604/ads-column-chooser/issues) or submit a pull request.

# Looking for help
- Need a cool logo.
- Need Tests.
- Any other suggestions would be great

## License
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
The *Column Chooser* extension is licensed under the [MIT License](LICENSE.md).

## This project utilizes the following dependencies:
  **Thank the authors for their contributions! Consider starring their repositories on GitHub.**
- [node-sql-parser](https://www.npmjs.com/package/node-sql-parser) [GitHub Repository](https://github.com/YourOrganization/node-sql-parser)
- [sql-formatter](https://www.npmjs.com/package/sql-formatter) [GitHub Repository](https://github.com/YourOrganization/sql-formatter)
  
