import pandas as pd
import sys

file_path = r'C:\Users\Nao\Downloads\出社ローテ.xlsx'
try:
    xl = pd.ExcelFile(file_path)
    print("Sheet names:", xl.sheet_names)
    # Check for sheets related to April or QA
    for sheet in xl.sheet_names:
        if 'エントリー(QA)' in sheet or '4月' in sheet or '4' in sheet:
            df = xl.parse(sheet)
            print(f"\n--- Content of sheet: {sheet} ---")
            # Output head to understand structure
            print(df.head(40).to_csv(index=False))
except Exception as e:
    print(f"Error: {e}")
