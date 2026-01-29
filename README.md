# 🏋️ Hevy Analytics

**Hevy Analytics** è una webapp (e desktop app) per analizzare in modo avanzato i dati degli allenamenti esportati da **Hevy**.  
Dashboard, confronti tra allenamenti, volumi, progressi, record e gestione degli allenamenti ignorati.

> Stack moderno, codice pulito, focus su analisi reali (non solo numerini carini).

---

## ✨ Funzionalità principali

- 📊 **Dashboard annuale**
  - Numero allenamenti
  - Giorni allenati
  - Distribuzione per mese

- 🏋️ **Allenamenti**
  - Storico completo
  - Confronto ultimo vs precedente dello stesso tipo (A/B/…)
  - Delta su:
    - carichi
    - reps
    - volume totale
  - Assegnazione tipo allenamento
  - Ignora / ripristina workout

- 🏆 **Record**
  - Massimali per esercizio
  - Miglior set (kg × reps)
  - Volume totale per esercizio

- 🚫 **Ignored**
  - Lista allenamenti ignorati
  - Ripristino rapido

- 🖥 **Desktop App**
  - Electron
  - Frontend + backend locali
  - Nessuna dipendenza cloud

---

## 🧱 Stack Tecnologico

### Frontend
- ⚛️ React + TypeScript
- ⚡ Vite
- 🎨 TailwindCSS
- 🔄 TanStack React Query

### Backend
- 🐍 Python 3.13
- ⚡ FastAPI
- 🗄 SQLAlchemy
- 🐬 MySQL
- 🔁 Sync da Hevy API

### Desktop
- 🖥 Electron
- 📦 electron-builder

---

## 📁 Struttura progetto

```text
hevy-analytics/
│
├── frontend/          # React + Vite + Tailwind
├── backend/           # FastAPI + SQLAlchemy
├── desktop/           # Electron app
│
├── .vscode/           # Task VSCode
├── .env.example       # Variabili d'ambiente
└── README.md
