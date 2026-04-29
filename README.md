# Auto Scroll Cifras

Aplicativo web para leitura de cifras com rolagem automática por **face tracking** e por **sincronização LRC**.

## Estrutura principal

- `src/pages/Library.jsx`: biblioteca e calibração da rolagem facial.
- `src/pages/Song.jsx`: tela de execução da cifra (face scroll + LRC scroll).
- `src/hooks/useFaceScroll.jsx`: lógica de detecção facial e rolagem por movimento.
- `src/hooks/useLrcScroll.jsx`: cronômetro e rolagem sincronizada via `lrcMapping`.
- `src/utils/lrcParser.js`: parser de LRC e parser de mapeamento temporal.
- `src/pages/admin/Dashboard.jsx`: CRUD de músicas no Firebase.

## Modelo de dados no Firebase (coleção `songs`)

Campos principais:

- `title` (string)
- `artist` (string)
- `tone` (string)
- `chords` (array estruturado da cifra)
- `syncedLyrics` (string no formato LRC)
- `lrcMapping` (objeto JSON com mapeamento de tempo → destino da cifra)

### Formato esperado de `lrcMapping`

Exemplo:

```json
{
  "00:45.00": "linha10",
  "01:30.50": "linha25",
  "02:10.00": "refrao",
  "02:42.20": "section-3"
}
```

#### Regras aceitas

- **Chave**: timestamp em formato `mm:ss`, `mm:ss.cc` ou `mm:ss.mmm`.
- **Valor (linha)**:
  - `linha10` (1-based)
  - `line-9` (0-based, id técnico)
  - `10` (equivalente a `linha10`)
- **Valor (seção)**:
  - nome da seção (ex.: `refrao`, `verso 2`, `ponte`)
  - id técnico `section-<indice>`

## Fluxo do modo LRC

1. Usuário ativa o toggle **LRC** na tela da cifra.
2. Usuário controla o cronômetro manualmente (`Play`, `Pause`, `Reset`).
3. Conforme o tempo avança, o app procura o último timestamp atingido em `lrcMapping`.
4. O scroll é posicionado automaticamente para a **linha** ou **seção** mapeada.
5. O scroll manual continua permitido durante toda a execução.

## Desenvolvimento

```bash
npm install
npm run dev
```
