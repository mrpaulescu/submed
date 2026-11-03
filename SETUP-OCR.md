# SubMed v2 — Setup felia OCR (scanare grilă)

Arhitectură: **OMR în browser** (`assets/js/omr.js`) → **Edge Function `score`**
(citește baremul server-side) → salvare în **Supabase** (`submissions` + Storage).
Fără Render, fără cold-start.

```
scan.html
  ├─ processSheet(file)        → matrice 150×5   (în browser, OpenCV-free)
  ├─ API.scoreMatrix(id,matr)  → Edge Function `score` → {score, questions[]}
  ├─ annotate(image,matr,key)  → imagine adnotată (în browser)
  └─ API.saveSubmission(...)   → submissions + bucket „sheets"
```

---

## 1. Creează bucket-ul de Storage „sheets"
Supabase → **Storage** → **New bucket**:
- Name: `sheets`
- Public: **OFF** (privat)

Apoi **SQL Editor** → rulează politicile (fiecare user vede/încarcă doar folderul lui):
```sql
create policy "own sheets upload" on storage.objects for insert
  with check (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own sheets read" on storage.objects for select
  using (bucket_id = 'sheets' and (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 2. Deployează Edge Function `score`
Ai nevoie de **Supabase CLI** (o singură dată):

| OS | Instalare |
|---|---|
| Windows (scoop) | `scoop install supabase` |
| npm (orice OS) | `npm i -g supabase` |

Apoi, din folderul `submed v2`:
```bash
supabase login                       # deschide browserul, te autentifici
supabase link --project-ref nicjhiqkdimipakeaanm   # ref-ul proiectului tău
supabase functions deploy score
```

> `SUPABASE_URL`, `SUPABASE_ANON_KEY` și `SUPABASE_SERVICE_ROLE_KEY` sunt
> injectate automat în funcție — **nu** trebuie să le configurezi manual.

Verifică în Supabase → **Edge Functions** → trebuie să apară `score` (deployed).

---

## 3. Seed: un examen + barem de test
SQL Editor → rulează `db/seed-exemplu.sql`.
Creează „Simulare Mai 2024 – Varianta 2" (tip foaie `submed`) cu 10 răspunsuri în barem.

---

## 4. Testează fluxul
1. `http://127.0.0.1:5173/scan.html` (logat).
2. La **Examen** alege „Simulare Mai 2024 – Varianta 2".
3. Încarcă o poză cu foaia de grilă submed (ex. `omr/IMG_0709.jpg` din v1).
4. Ar trebui să vezi, pe rând:
   - „Se citește grila (în browser)..." (OMR local)
   - „Se verifică baremul..." (Edge Function)
   - imaginea **adnotată** (verde = corect, roșu = greșit, portocaliu = corect omis)
   - scorul (din cele 10 întrebări notate)
5. **Salvează rezultat** → apare în `dashboard.html` (Istoric) și în Supabase
   → Table Editor → `submissions`.

---

## Probleme frecvente
- **„Barem inexistent pentru acest examen":** n-ai rulat seed-ul (pasul 3) sau ai ales alt examen.
- **Eroare la `functions.invoke`:** funcția nu e deployată (pasul 2) sau nu ești logat.
- **Imaginea nu se încarcă / „Upload Storage eșuat":** bucket-ul „sheets" sau politicile lipsesc (pasul 1). Scorul se calculează oricum; doar imaginea nu se salvează.
- **Scor 0 sau bule greșit detectate:** calibrarea OMR e pentru foaia submed la ~1500×2000px. Dacă folosești altă foaie, trebuie ajustată calibrarea în `assets/js/omr.js` (secțiunea `CONFIGS`). Vezi pasul de calibrare separat.
- **Răspunsurile corecte apar în Network tab:** normal — vin DOAR după scanare, ca feedback. Baremul complet nu e accesibil înainte de scanare (e citit server-side în Edge Function).
