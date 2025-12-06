import pandas as pd
import os
from pathlib import Path
from typing import List


class ExcelService:
    def __init__(self, storage_path=None):
        if storage_path:
            self.storage_path = storage_path
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent
            self.storage_path = str(base_dir / "storage")
        os.makedirs(self.storage_path, exist_ok=True)

    def merge_excels(self, file_paths: List[str], output_filename: str) -> str:
        """
        Merges multiple Excel files into one.
        Assumes all files have the same structure.
        Adds a 'Source' column or just appends.
        """
        all_data = []
        for file in file_paths:
            if os.path.exists(file):
                try:
                    df = pd.read_excel(file)
                    # Clean headers
                    df.columns = df.columns.str.strip()
                    # Add source
                    df['Source File'] = Path(file).name
                    all_data.append(df)
                except Exception as e:
                    print(f"Error reading {file}: {e}")
        
        if not all_data:
            return ""

        merged_df = pd.concat(all_data, ignore_index=True)
        
        # Add auto-increment ID if '序号' exists or just as index
        if '序号' in merged_df.columns:
            merged_df['序号'] = range(1, len(merged_df) + 1)
        else:
            merged_df.insert(0, '序号', range(1, len(merged_df) + 1))

        output_path = os.path.join(self.storage_path, output_filename)
        merged_df.to_excel(output_path, index=False)
        return output_path

excel_service = ExcelService()
