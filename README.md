# MD Project - Planlægningsværktøj 🚀

Velkommen til **MD Project**, et moderne, fuldt udstyret tidsplanlægnings- og resursestyringsværktøj specialdesignet til danske byggeprojekter, håndværksfag og entreprenørsager. 

Applikationen byder på et yderst visuelt interface, der hjælper projektledere med at balancere ressourcer, budgetter, tidsbjælker og overholde vitale deadlines.

---

## 📖 Indholdsfortegnelse
1. [Nøglefunktioner](#-nøglefunktioner)
2. [Interface & Faner](#-interface--faner)
3. [Teknisk Arkitektur](#-teknisk-arkitektur)
4. [GitHub-guide: Sådan importerer du appen](#-github-guide-sådan-importerer-du-appen)
5. [Installation & Lokal Kørsel](#-installation--lokal-kørsel)

---

## ✨ Nøglefunktioner

### 1. Dynamisk Gantt-diagram (Gantt-kort)
* Det centrale omdrejningspunkt i applikationen! Viser tidsbjælker for alle opgaver på en løbende uge- og dagsskala.
* **Overskuelige linjer**: Weekender og konfigurerede helligdage er tydeligt afmærket og skraveret, så du hurtigt kan spotte spidsbelastninger.

### 2. Etaper & Projektfaser 🧱
* Du kan oprette overordnede **Projektfaser / Etaper** under fanen *Projekt*.
* Hver etape tildeles faste tidsintervaller (start- og slutdato) samt en flot, unik farvekode.
* Etaperne vises som vandrette, prægtige baggrunds- eller topbjælker på Gantt-diagrammet. 
* Du kan knytte almindelige eller tilbagevendende enkeltopgaver til specifikke etaper, så du bevarer den rette røde tråd.

### 3. Tilbagevendende Serviceopgaver (Recurrence) ↻
* Mulighed for at håndtere **tilbagevendende drifts- eller serviceopgaver** (f.eks. ugentlig affaldstømning, tømning af containere, ugentligt sikkerhedstjek, m.m.).
* Systemet understøtter faste gentagelsesintervaller (f.eks. hver 7. dag) og beregner automatisk alle forekomster i projektets levetid, eller begrænset til specifikke valgte etaper.
* Der kan fastsættes en fast **enhedspris pr. overførsel**, som medregnes direkte i det samlede økonomiske overblik.
* Gentagelserne præsenteres som fine, cirkulære `↻` statussymboler direkte på Gantt-målestokken i den pågældende faggruppes farve.

### 4. Kritisk Vej (Critical Path Method) 🔥
* Vores indbyggede tidsplanlægningsmotor beregner automatisk den **kritiske kemiske kæde** af opgaver.
* Hvis en opgave markeret med den røde flamme (<Flame className="w-4 h-4 inline" /> / 🔥) bliver forsinket blot én enkelt dag, vil **hele projektets endelige leveringsdato** blive skubbet tilsvarende!
* Opgaver på den kritiske vej markeres med en markant rød ramme og særskilt statusmærkat, så du ved, hvor der absolut ikke må ske overskridelser.

### 5. Smart Tidsplanlægningsmotor (Scheduler Engine) 📅
* Tager højde for **Finish-to-Start** afhængigheder (forgængere).
* Undgår automatisk weekender og helligdage ved beregning af arbejdsdage, medmindre du eksplicit tillader dette på den enkelte opgave (*Tillad weekendarbejde* eller *Arbejde på helligdage*).
* Justerer sig lynhurtigt ved hver eneste ændring, du foretager.

### 6. Finansiell overenskomst & Ressurser 👷
* Opret og administrer faggrupper (Tømrer, Elektriker, VVS, Jord & Beton osv.) med særskilte timelønninger, overarbejdstillæg samt dagsnormer.
* Det integrerede **Økonomipanel (Overblik)** viser en fuldkommen budget-profil: Lønudgifter, materialeomkostninger, kørsel, etape-gebyrer samt faste udgifter for tilbagevendende ydelser.

### 7. Import & Eksport (Hurtig Backup) 💾
* Gem dit projekt på din egen harddisk med ét klik på **Gem**. Hele projektet gemmes som en let `.json`-fil.
* Klik på **Åbn** for at indlæse en gemt projektfil og fortsætte jeres præcise planlægning med det samme.

---

## 🖥 Interface & Faner

Applikationen er opdelt i 6 intuitive, fuldt responsive faner:

1. **Opgaver (Listekoordinator)**: Opret og rediger jeres byggeopgaver og serviceintervaller. Det er også her, du styrer varighed, overenskomster, forgængere og etapetilknytning.
2. **Gantt (Tidsplan)**: Det store visuelle, horisontale Gantt-kort med filtrering på faggrupper, visning af etaper og tilbagevendende markører.
3. **Resurser (Faggrupper)**: Oversigt over de aktive faggrupper og mandskab, deres timepriser og farvekoder.
4. **Økonomi (Budgetstyring)**: Præcise finansielle grafer (Recharts visualiseringer), faggruppernes timeforbrug samt omkostninger fordelt på etaper og enkeltstående vs. løbende ugifter.
5. **Projekt (Indstillinger & Etaper)**: Konfiguration af projektets officielle startdato, daglige arbejdstimer, helligdagskalender (f.eks. tilføjelse af industriferie, jul, påske m.m.) samt oprettelse, overblik og sletning af de overordnede **Etaper**.
6. **Vidensbase (Ordliste)**: En grundggående forklaring af begreber som *Kritisk Vej*, *Slæktid/Buffer* og *Finish-to-Start* afhængigheder på letforståeligt dansk.

---

## 🛠 Teknisk Arkitektur

Projektet er opbygget som en robust, moderne web-applikation:
* **Frontend**: React 18+ (med TypeScript), Vite som lynhurtig bundler, og Tailwind CSS til stilren, responsiv styling.
* **Animationer**: `motion/react` til yndefulde overgange og state-finesser.
* **Visualiseringer**: `recharts` til moderne, interaktive budgetdiagrammer.
* **Ikoner**: Det elegante og konsistente `lucide-react` bibliotek.
* **Backend (Valgfri)**: En Express-baseret server i `server.ts` til eventuelle server-side integrations- og API-kald uden at kompromittere følsomme nøgler.

---

## 🐙 GitHub-guide: Sådan importerer du appen

Du kan nemt få denne applikation over på din egen GitHub-profil, så du kan arbejde videre på kildekoden eller dele den med kollegaer.

### Metode A: Direkte eksport via Google AI Studio (Nemmest!)
1. Kig i **øverste højre hjørne** af Google AI Studio-skærmen (eller i menuen **Indstillinger / Settings**).
2. Her finder du en knap/menu, der hedder **Export to GitHub** (eller **Download ZIP**).
3. Vælger du **GitHub**, vil AI Studio bede om tilladelse til at oprette et nyt arkiv (repository) direkte på din personlige GitHub-konto og overføre alle filer med det samme.
4. Vælger du **Download ZIP**, gemmer du en fuld arkivfil med al kildekoden direkte på din computer.

### Metode B: Manuel upload via Git (Hvis du downloadede en .zip)
Hvis du har hentet en `.zip`-fil til din computer, kan du uploade den manuelt ved at følge disse 5 enkle trin i din terminal:

1. **Udpak ZIP-filen** i en ny mappe på din computer.
2. Open din terminal i den udpakkede mappe og kør:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: MD Project Planlægningsværktøj"
   ```
3. Opret et **nyt repository** på din [GitHub](https://github.com) (undlad at tilføje README, .gitignore eller licens, da disse allerede findes i projektet).
4. Forbind dit lokale projekt til din nye GitHub-repo ved at køre følgende:
   ```bash
   git branch -M main
   git remote add origin https://github.com/MrDahl/MD-Project-Pro.git
   git push -u origin main
   ```

Når kildekoden er skubbet (pushet) til dit repository, vil din nye GitHub Action automatisk bygge og udrulle appen direkte til din personlige hjemmeside på:
👉 **https://MrDahl.github.io/MD-Project-Pro/**

---

## 💻 Installation & Lokal Kørsel

Hvis du vil køre programmet lokalt på din egen computer:

1. **Sørg for, at Node.js (v18+) er installeret.**
2. **Installer alle nødvendige pakker:**
   ```bash
   npm install
   ```
3. **Kør udviklingsserveren lokalt:**
   ```bash
   npm run dev
   ```
4. Åbn din browser på [http://localhost:3000](http://localhost:3000) for at køre og teste dit planlægningsværktøj!

---

*Værktøjet er udviklet med fokus på brugervenlighed, gennemsigtighed og præcis projektplanlægning. Rigtig god fornøjelse med dit næste byggeprojekt!* 🛠🏗
