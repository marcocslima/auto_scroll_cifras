
# -*- coding: utf-8 -*-
"""
Versão do script generate_lrc_mappings para ser executado no Google Colab.

Este script gera o `lrcMapping` para uma única música, correlacionando
o tempo do LRC (`syncedLyrics`) com a estrutura da cifra (`chords`).

Como usar no Google Colab:
1. Execute a primeira célula para instalar o `firebase-admin`.
2. Na segunda célula, execute o código para fazer o upload do seu
   arquivo `serviceAccountKey.json`.
3. Na célula "Exemplo de Uso", cole os dados da sua música
   (os campos `syncedLyrics` e `chords`) nas variáveis correspondentes.
4. Execute a célula "Exemplo de Uso" para gerar e visualizar o mapeamento.
5. Opcional: Se desejar, pode adicionar código para salvar o mapeamento
   de volta no Firestore.
"""

# Célula 1: Instalar as dependências
!pip install firebase-admin

# Célula 2: Fazer upload do serviceAccountKey.json e inicializar o Firebase
import firebase_admin
from firebase_admin import credentials, firestore
import os
import re
import unicodedata
from google.colab import files

# --- Configuração do Firebase ---
SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'

def initialize_firebase():
    """Inicializa o SDK do Firebase Admin se não estiver inicializado."""
    if not firebase_admin._apps:
        if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
            firebase_admin.initialize_app(cred)
            print("Firebase Admin SDK inicializado com sucesso.")
            return firestore.client()
        else:
            print(f"Arquivo de credenciais '{SERVICE_ACCOUNT_KEY_PATH}' não encontrado.")
            print("Por favor, execute a célula abaixo para fazer o upload do arquivo.")
            return None
    return firestore.client()

# Faz o upload do arquivo de credenciais
if not os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
    print("Faça o upload do seu arquivo serviceAccountKey.json do Firebase.")
    uploaded = files.upload()
    if SERVICE_ACCOUNT_KEY_PATH not in uploaded:
        print("\nUpload cancelado ou arquivo com nome incorreto.")
    else:
        print(f"\n'{SERVICE_ACCOUNT_KEY_PATH}' carregado com sucesso!")

# Inicializa o Firebase após o upload
db = initialize_firebase()


# --- Funções de Lógica (Corrigidas) ---

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
    # CORREÇÃO: A regex agora está em uma única linha para evitar o SyntaxError.
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

# --- Função Principal para o Colab ---

def generate_lrc_mapping_for_song(song_data):
    """
    Gera o lrcMapping para uma única música.
    """
    lrc_text = song_data.get('syncedLyrics')
    chords_data = song_data.get('chords')

    if not lrc_text or not chords_data:
        print("Dados de 'syncedLyrics' ou 'chords' ausentes.")
        return {}

    try:
        lrc_lines = parse_lrc(lrc_text)
        if not lrc_lines:
            print("Não foi possível parsear o conteúdo do LRC.")
            return {}

        cifra_sections = parse_chords_structure(chords_data)
        if not cifra_sections:
            print("Não foi possível parsear a estrutura da cifra.")
            return {}
        
        print(f"Analisando {len(lrc_lines)} linhas de LRC e {len(cifra_sections)} seções na cifra.")
        lrc_mapping = generate_lrc_mapping(lrc_lines, cifra_sections)

        if lrc_mapping:
            print(f"Mapeamento gerado com sucesso com {len(lrc_mapping)} entradas.")
        else:
            print("Nenhum mapeamento pôde ser gerado.")
        
        return lrc_mapping

    except Exception as e:
        print(f"Ocorreu um erro inesperado: {e}")
        return {}

# --- Exemplo de Uso ---

synced_lyrics_data = """
[00:16.89]Sonda-me, ó Deus
[00:20.89]Pois vês meu coração
[00:24.79]Prova-me, ó Pai
[00:28.84]Te dou meu coração
[00:32.49]Livre de todo mal
[00:36.56]Quero somente a Ti amar
[00:40.54]Pois sei que podes me guiar
[00:44.60]Em Teus caminhos de amor
[01:01.49]Sonda-me, ó Deus
[01:22.38]Pois vês meu coração
"""

chords_data = [
    {"section": "Intro"},
    {"lyric": "[ D G/D D G/D ]"},
    {"section": "Estrofe 1"},
    {"lyric": "  D             G/D      D   G/D"},
    {"lyric": "Sonda-me, ó Deus"},
    {"lyric": "       D           G/D        A4  A"},
    {"lyric": "Pois vês meu coração"},
    {"lyric": "   G/B         A/C#     D    A/C#   Bm7"},
    {"lyric": "Prova-me, ó Pai"},
    {"lyric": "          Em7      G/A       D   G/A"},
    {"lyric": "Te dou meu coração"},
    {"section": "Refrão"},
    {"lyric": "        D           A/C#    Bm7"},
    {"lyric": "Livre de todo mal"},
    {"lyric": "       F#m7           G7M"},
    {"lyric": "Quero somente a Ti amar"},
    {"lyric": "        D/F#          Em7"},
    {"lyric": "Pois sei que podes me guiar"},
    {"lyric": "        G/A              D   (G/D A/D)"},
    {"lyric": "Em Teus caminhos de amor"}
]

song_to_process = {
    "syncedLyrics": synced_lyrics_data,
    "chords": chords_data
}

generated_mapping = generate_lrc_mapping_for_song(song_to_process)

if generated_mapping:
    print("\n--- Mapeamento Gerado ---")
    import json
    print(json.dumps(generated_mapping, indent=2))
