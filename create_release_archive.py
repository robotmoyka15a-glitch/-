import zipfile
import os
import sys

def create_release_archive():
    archive_name = "WashControl_Full_v1.0.0.zip"
    root_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Список папок и файлов, которые НЕ нужно включать в архив
    exclude_dirs = {
        '__pycache__', 
        'node_modules', 
        '.git', 
        '.venv', 
        'venv', 
        'env', 
        '.pytest_cache',
        'build',
        'dist'
    }
    
    exclude_files = {
        '.DS_Store', 
        'Thumbs.db', 
        '*.pyc', 
        '*.log',
        'washcontrol.db', # База данных будет создана заново при первом запуске
        '.env' # Конфиги безопасности не должны уходить в релиз
    }

    print(f"📦 Начало упаковки проекта WashControl v1.0.0...")
    print(f"📂 Корневая директория: {root_dir}")
    
    with zipfile.ZipFile(archive_name, 'w', zipfile.ZIP_DEFLATED) as zipf:
        file_count = 0
        
        for foldername, subfolders, filenames in os.walk(root_dir):
            # Исключаем ненужные папки
            subfolders[:] = [d for d in subfolders if d not in exclude_dirs]
            
            for filename in filenames:
                # Исключаем ненужные файлы по имени и расширению
                if filename in exclude_files or any(filename.endswith(ext) for ext in ['*.pyc', '*.log']):
                    continue
                
                # Полный путь к файлу
                filepath = os.path.join(foldername, filename)
                
                # Относительный путь для архива
                arcname = os.path.relpath(filepath, root_dir)
                
                # Добавляем файл в архив
                zipf.write(filepath, arcname)
                file_count += 1
                print(f"  ✅ Добавлен: {arcname}")

    print("\n" + "="*50)
    print(f"🎉 УСПЕШНО! Архив создан: {os.path.abspath(archive_name)}")
    print(f"📊 Всего файлов упаковано: {file_count}")
    print(f"💾 Размер архива: {round(os.path.getsize(archive_name) / 1024 / 1024, 2)} MB")
    print("="*50)
    print("\n📥 Теперь вы можете передать этот ZIP-файл кому угодно!")
    print("🚀 Для запуска просто распакуйте и следуйте инструкции в README.md")

if __name__ == "__main__":
    try:
        create_release_archive()
    except Exception as e:
        print(f"❌ Ошибка при создании архива: {e}")
        sys.exit(1)
