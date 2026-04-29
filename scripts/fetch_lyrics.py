# -*- coding: utf-8 -*-

import firebase_admin
from firebase_admin import credentials, firestore
import requests
import os

# --- Configuração do Firebase ---
# **ATENÇÃO:** O caminho para o arquivo de credenciais do Firebase.
# Garanta que o arquivo `serviceAccountKey.json` (ou o nome que você usou) está na raiz do projeto.
SERVICE_ACCOUNT_KEY_PATH = 'serviceAccountKey.json'

def initialize_firebase():
    """Inicializa o SDK do Firebase Admin."""
    if os.path.exists(SERVICE_ACCOUNT_KEY_PATH):
        cred = credentials.Certificate(SERVICE_ACCOUNT_KEY_PATH)
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app(cred)
        print("Firebase Admin SDK inicializado com sucesso.")
        return firestore.client()
    else:
        print(f"ERRO: Arquivo de credenciais '{SERVICE_ACCOUNT_KEY_PATH}' não encontrado.")
        print("Por favor, baixe o arquivo do Console do Firebase e coloque-o na raiz do projeto.")
        return None

def get_lyrics_from_api(artist, title):
    """Busca a letra de uma música na API lyrics.ovh."""
    try:
        url = f"https://api.lyrics.ovh/v1/{artist}/{title}"
        response = requests.get(url, timeout=10) # Timeout de 10 segundos
        if response.status_code == 200:
            data = response.json()
            return data.get('lyrics', '')
        else:
            return None
    except requests.RequestException as e:
        print(f"  - Erro na API para \'{title}\': {e}")
        return None

def get_first_line(lyrics):
    """Extrai a primeira linha não vazia da letra."""
    if not lyrics:
        return ""
    lines = lyrics.strip().split('\n')
    for line in lines:
        if line.strip():
            return line.strip()
    return ""

def main():
    """Função principal para buscar letras e atualizar o Firestore."""
    db = initialize_firebase()
    if not db:
        return

    songs_ref = db.collection('songs')
    songs = songs_ref.stream()

    print("\nIniciando a busca e atualização das letras das músicas...")

    songs_to_update = list(songs)
    total_songs = len(songs_to_update)

    for i, song in enumerate(songs_to_update):
        song_data = song.to_dict()
        song_id = song.id
        title = song_data.get('title')
        artist = song_data.get('artist')

        print(f"\n({i+1}/{total_songs}) Processando: '{title}' por '{artist}'")

        # Pula se a letra já existir para não fazer chamadas desnecessárias
        if 'lyrics' in song_data and song_data['lyrics']:
            print("  - Letra já existe. Pulando.")
            continue

        lyrics = get_lyrics_from_api(artist, title)

        if lyrics:
            first_line = get_first_line(lyrics)
            print(f"  - Letra encontrada! Primeira linha: \"{first_line}\"")
            
            # Atualiza o documento no Firestore com a letra e a primeira linha
            songs_ref.document(song_id).update({
                'lyrics': lyrics,
                'firstLyricLine': first_line
            })
            print(f"  - Firestore atualizado para a música ID: {song_id}")
        else:
            print("  - Letra não encontrada na API.")
    
    print("\n--- Processo concluído! ---")

if __name__ == '__main__':
    main()
