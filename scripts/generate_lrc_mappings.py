
# -*- coding: utf-8 -*-
import firebase_admin
from firebase_admin import credentials, firestore
import os
import re
import unicodedata

# --- Configuração do Firebase ---
# **ATENÇÃO:** O caminho para o arquivo de credenciais do Firebase.
# Garanta que o arquivo `serviceAccountKey.json` está na raiz do projeto.
SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'

def initialize_firebase():
    """Inicializa o SDK do Firebase Admin se não estiver inicializado."""
    if not firebase_admin._apps:
        if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK inicializado com sucesso.")
        else:
            print(f"ERRO: Arquivo de credenciais '{SERVICE_ACCOUNT_KEY_PATH}' não encontrado.")
            print("Por favor, baixe o arquivo do Console do Firebase e coloque-o na raiz do projeto.")
            return None
    return firestore.client()

def normalize_text(text):
    """Normaliza o texto: remove acentos, pontuação, espaços e converte para minúsculas."""
    if not text:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', text)
    text = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    text = re.sub(r'[^a-zA-Z0-9\s]', '', text)
    return text.lower().strip()

def parse_lrc(lrc_text):
    """Extrai timestamps e texto de um LRC. Retorna uma lista de (timestamp, texto)."""
    if not lrc_text:
        return []
    
    lrc_lines = []
    # CORREÇÃO: A regex foi colocada em uma única linha para evitar SyntaxError
    pattern = re.compile(r'\[(\d{2}:\d{2}\.\d{2,3})\]([^
]*)')
    matches = pattern.findall(lrc_text)
    
    for match in matches:
        timestamp = match[0]
        text = match[1].strip()
        if text:
            lrc_lines.append((timestamp, text))
            
    return lrc_lines

def parse_chords_structure(chords_array):
    """Analisa a estrutura da cifra e retorna uma lista de seções e suas linhas."""
    sections = []
    current_section = {
        "title": "Início",
        "normalized_title": "inicio",
        "dom_id": "section-0",
        "lines": []
    }
    global_line_index = 0
    section_index = 0

    def normalize_section_key(title):
        return re.sub(r'[^a-z0-9]', '', title.lower())

    for item in chords_array:
        if isinstance(item, dict) and 'section' in item:
            if current_section["lines"]:
                sections.append(current_section)
            
            section_index += 1
            title = item['section']
            current_section = {
                "title": title,
                "normalized_title": normalize_section_key(title),
                "dom_id": f"section-{section_index}",
                "lines": []
            }
        elif isinstance(item, dict) and 'lyric' in item:
            lyric_text = item.get('lyric', '')
            visible_text = lyric_text.split('\n')[-1] if '\n' in lyric_text else lyric_text
            
            if visible_text.strip():
                current_section["lines"].append({
                    "id": f"line-{global_line_index}",
                    "text": visible_text,
                    "section_ref": current_section
                })
            
            global_line_index += 1
            
    if current_section["lines"]:
        sections.append(current_section)

    return sections

def generate_lrc_mapping(lrc_lines, cifra_sections):
    """Gera o lrcMapping lidando com repetições."""
    mapping = {}
    
    flat_cifra_lines = []
    for section in cifra_sections:
        for i, line in enumerate(section["lines"]):
            target_id = section["normalized_title"] if i == 0 else line["id"]
            flat_cifra_lines.append({
                "text": line["text"],
                "target_id": target_id
            })

    cifra_cursor = 0

    for timestamp, lrc_text in lrc_lines:
        normalized_lrc_text = normalize_text(lrc_text)
        if not normalized_lrc_text:
            continue

        match_found = False
        # 1. Tenta encontrar a correspondência a partir do cursor atual
        for i in range(cifra_cursor, len(flat_cifra_lines)):
            cifra_line = flat_cifra_lines[i]
            if normalize_text(cifra_line["text"]) == normalized_lrc_text:
                mapping[timestamp] = cifra_line["target_id"]
                cifra_cursor = i + 1
                match_found = True
                break
        
        # 2. Se não encontrou (pode ser uma repetição), busca desde o início
        if not match_found:
            for i in range(len(flat_cifra_lines)):
                cifra_line = flat_cifra_lines[i]
                if normalize_text(cifra_line["text"]) == normalized_lrc_text:
                    mapping[timestamp] = cifra_line["target_id"]
                    cifra_cursor = i + 1
                    break
    
    return mapping

def main():
    """Função principal para gerar e atualizar lrcMapping no Firestore."""
    db = initialize_firebase()
    if not db:
        return

    songs_ref = db.collection('songs')
    songs_stream = songs_ref.stream()

    print("\nIniciando a geração de lrcMapping para as músicas...")
    
    updated_count = 0
    skipped_count = 0

    for song in songs_stream:
        song_data = song.to_dict()
        song_id = song.id
        title = song_data.get('title', 'Sem Título')

        print(f"\n--- Processando: '{title}' (ID: {song_id}) ---")

        lrc_text = song_data.get('syncedLyrics')
        chords_data = song_data.get('chords')

        if song_data.get('lrcMapping') and isinstance(song_data.get('lrcMapping'), dict) and len(song_data.get('lrcMapping')) > 0:
            print("  - Mapeamento já existe. Pulando.")
            skipped_count += 1
            continue
        
        if not lrc_text or not chords_data:
            print("  - `syncedLyrics` ou `chords` ausentes. Pulando.")
            skipped_count += 1
            continue

        try:
            lrc_lines = parse_lrc(lrc_text)
            if not lrc_lines:
                print("  - Não foi possível parsear o conteúdo do LRC. Pulando.")
                skipped_count += 1
                continue

            cifra_sections = parse_chords_structure(chords_data)
            if not cifra_sections:
                print("  - Não foi possível parsear a estrutura da cifra. Pulando.")
                skipped_count += 1
                continue
            
            print(f"  - {len(lrc_lines)} linhas de LRC encontradas.")
            print(f"  - Analisando {len(cifra_sections)} seções na cifra.")
            
            lrc_mapping = generate_lrc_mapping(lrc_lines, cifra_sections)

            if lrc_mapping:
                print(f"  - Mapeamento gerado com sucesso com {len(lrc_mapping)} entradas.")
                songs_ref.document(song_id).update({
                    'lrcMapping': lrc_mapping
                })
                print(f"  - Firestore atualizado para a música ID: {song_id}")
                updated_count += 1
            else:
                print("  - Nenhum mapeamento pôde ser gerado.")
                skipped_count += 1

        except Exception as e:
            print(f"  - ERRO INESPERADO ao processar a música: {e}")
            skipped_count += 1

    print(f"\n--- Processo concluído! ---")
    print(f"Músicas atualizadas: {updated_count}")
    print(f"Músicas puladas: {skipped_count}")

if __name__ == '__main__':
    main()
