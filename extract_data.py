import xml.etree.ElementTree as ET
import json
import os
import re
import zipfile
from datetime import datetime, timedelta

def get_shared_strings(z):
    shared_strings = []
    with z.open('xl/sharedStrings.xml') as f:
        tree = ET.parse(f)
        root = tree.getroot()
        ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in root.findall('main:si', ns):
            t = si.find('main:t', ns)
            if t is not None:
                shared_strings.append(t.text)
            else:
                r_texts = si.findall('main:r', ns)
                text = "".join([r.find('main:t', ns).text for r in r_texts if r.find('main:t', ns) is not None])
                shared_strings.append(text)
    return shared_strings

def extract_sheet_data(z, sheet_name, shared_strings):
    try:
        with z.open(f'xl/worksheets/{sheet_name}.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
    except KeyError:
        return []
    
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    qa_col_prefix = None
    records = []
    
    for row in root.findall('.//ns:row', ns):
        if qa_col_prefix is None:
            for cell in row.findall('ns:c', ns):
                if cell.get('t') == 's':
                    v_elem = cell.find('ns:v', ns)
                    if v_elem is not None:
                        try:
                            s_idx = int(v_elem.text)
                            s_val = shared_strings[s_idx]
                            if 'エントリー' in s_val and 'QA' in s_val:
                                match = re.search(r'^[A-Z]+', cell.get('r', ''))
                                if match:
                                    qa_col_prefix = match.group(0)
                        except: pass
        
        date_cell = None
        for cell in row.findall('ns:c', ns):
            if cell.get('r','').startswith('B'):
                date_cell = cell
                break
        
        if date_cell is not None:
            raw_val = date_cell.find('ns:v', ns)
            if raw_val is None: continue
            
            val = raw_val.text
            date_str = None
            
            if date_cell.get('t') != 's':
                try:
                    serial = float(val)
                    if serial > 40000:
                        dt = datetime(1899, 12, 30) + timedelta(days=serial)
                        date_str = dt.strftime('%Y-%m-%d')
                except: pass
            else:
                try:
                    s_idx = int(val)
                    s_val = shared_strings[s_idx]
                    match = re.search(r'(\d+)/(\d+)', s_val)
                    if match:
                        m, d = match.groups()
                        date_str = f"2026-{int(m):02d}-{int(d):02d}"
                except: pass
            
            if not date_str: continue

            location = ""
            if qa_col_prefix:
                for cell in row.findall('ns:c', ns):
                    if cell.get('r','').startswith(qa_col_prefix):
                        loc_raw = cell.find('ns:v', ns)
                        if loc_raw is not None:
                            l_val = loc_raw.text
                            if cell.get('t') == 's':
                                location = shared_strings[int(l_val)]
                            else:
                                location = l_val
                        break
            
            if date_str:
                records.append({
                    "date": date_str,
                    "location": location.strip()
                })
    return records

def main():
    # ユーザーがダウンロードしたExcelファイルを直接指定（ローカルもしくはプロジェクト直下）
    possible_paths = [
        r'C:\Users\Nao\Downloads\出社ローテ.xlsx',
        r'出社ローテ.xlsx'
    ]
    
    excel_file = None
    for p in possible_paths:
        if os.path.exists(p):
            excel_file = p
            break
            
    if not excel_file:
        print("エラー: '出社ローテ.xlsx' がダウンロードフォルダ、または現在のフォルダに見つかりません。")
        return

    print(f"データを抽出中... ({excel_file})")
    with zipfile.ZipFile(excel_file, 'r') as z:
        shared_strings = get_shared_strings(z)
        
        # 2月(sheet6)、3月(sheet7)、4月(sheet8)を読み込み
        feb_data = extract_sheet_data(z, 'sheet6', shared_strings)
        march_data = extract_sheet_data(z, 'sheet7', shared_strings)
        april_data = extract_sheet_data(z, 'sheet8', shared_strings)
        
    all_data = feb_data + march_data + april_data
    
    output_dir = 'public'
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    out_file = os.path.join(output_dir, 'data.json')
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(all_data, f, ensure_ascii=False, indent=2)
    
    print(f"抽出完了！ 全 {len(all_data)} 件のデータを {out_file} に保存しました。")

if __name__ == "__main__":
    main()

