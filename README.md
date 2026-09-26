# MPLADS AI-Powered Monitoring, Fraud & Inefficiency Analytics Platform
**Smart India Hackathon (SIH) 2026 | Problem ID: SIH26102**
**Organization:** Ministry of Statistics and Programme Implementation (MoSPI)  
**Theme:** Smart Automation / Governance Tech

---

## Table of Contents
- [Overview](#-overview)
- [Key Features & Automation](#-key-features--automation)
- [Tech Stack](#-tech-stack)
- [Project Architecture](#-project-architecture)
- [Local Setup & Installation](#-local-setup--installation)
- [API Documentation](#-api-documentation)
- [Live Deployment Links](#-live-deployment-links)

---

## Overview
The **Members of Parliament Local Area Development Scheme (MPLADS)** involves large-scale fund utilization and thousands of concurrent infrastructure projects across India. Traditional monitoring is often reactive, manual, and prone to bureaucratic delays or fund leakages. 

This project provides an **AI-driven command-center platform** that ingests project data, automatically flags financial anomalies using machine learning, tracks administrative milestone delays, and delivers role-based insights to MoSPI officials, District Authorities, and Members of Parliament.

---

## Key Features & Automation
1. **Unsupervised Machine Learning Anomaly Detection:** Uses an *Isolation Forest* algorithm to instantly spot multi-dimensional cost overruns and budget inflations without requiring pre-labeled fraud data.
2. **Automated Bureaucratic Delay Tracking:** Computes approval lag times between MP work proposals and district administrative sanctions.
3. **Smart Duplicate Work Flagging:** Cross-references work titles within districts to catch duplicate fund allocation proposals.
4. **Multi-Role Contextual Views:** Interactive UI toggles enabling customized views for *MoSPI Officials*, *District Authorities*, and *MPs*.
5. **Real-time Compliance Scoring:** Dynamically computes a national norm-adherence and health index.

---

## Tech Stack
* **Frontend:** React (Vite), Tailwind CSS, Lucide Icons
* **Backend:** Python, FastAPI, Pandas, Scikit-Learn, NumPy
* **Deployment:** Vercel (Frontend) & Render (Backend)

---

## Project Architecture
```text
SIH26102_mplads_ai_platform/
├── backend/
│   ├── data/
│   │   └── processed_mplads_data.csv
│   ├── venv/
│   ├── main.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.js
└── README.md