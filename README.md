# MD Project (MD-Project-Pro)

Tidsplan, ressourcer og økonomi til byggeprojekter og entrepriser. Appen kører i browseren, kræver ingen login og gemmer projektet på din egen computer.

**Prøv den her:** [https://MrDahl.github.io/MD-Project-Pro/](https://MrDahl.github.io/MD-Project-Pro/)

Denne fil er både en kort introduktion og en **brugsvejledning**. Spring direkte til det, du skal bruge:

1. [Kom i gang på 5 minutter](#1-kom-i-gang-på-5-minutter)
2. [Overblik over appen](#2-overblik-over-appen)
3. [Opgaver og afhængigheder](#3-opgaver-og-afhængigheder)
4. [Gantt-diagrammet](#4-gantt-diagrammet)
5. [Faggrupper, ressourcer og bemanding](#5-faggrupper-ressourcer-og-bemanding)
6. [Arbejdstider og timeplanlægning](#6-arbejdstider-og-timeplanlægning)
7. [Etaper, milepæle og gentagende opgaver](#7-etaper-milepæle-og-gentagende-opgaver)
8. [Kalender: helligdage og vejr](#8-kalender-helligdage-og-vejr)
9. [Økonomi](#9-økonomi)
10. [Print og PDF af hele tidsplanen](#10-print-og-pdf-af-hele-tidsplanen)
11. [Store projekter](#11-store-projekter)
12. [Gem, åbn, fortryd og sikkerhedskopi](#12-gem-åbn-fortryd-og-sikkerhedskopi)
13. [Genveje](#13-genveje)
14. [Spørgsmål og svar](#14-spørgsmål-og-svar)
15. [Til udviklere](#15-til-udviklere)

---

## 1. Kom i gang på 5 minutter

**Hurtigst: start fra en skabelon.**

1. Tryk **Nyt** øverst til højre.
2. Vælg en skabelon:
   - **Nyt parcelhus**, **Renovering af badeværelse**, **Tilbygning**: små, overskuelige eksempler.
   - **Eldag i timer (detaljeret)**: viser planlægning på klokkeslæt med hold og pauser.
   - **Charmdal lejligheder (stort projekt)**: 226 opgaver i 7 zoner over ca. 5 år, til stresstest og som kompleks øvelse.
3. Skabelonen åbner med faggrupper, etaper, afhængigheder og milepæle, som du kan ændre frit.

**Fra bunden: brug guiden.** Under *Nyt* kan du vælge "Start med guiden", som spørger efter projektnavn, startdato, arbejdstimer og faggrupper.

**Din første opgave:**

1. Gå til fanen **Tidsplan** og tryk **Opgaver**.
2. Tryk **Ny opgave**. Skriv titel, varighed og vælg faggruppe.
3. Vælg under *Forgængere*, hvilken opgave der skal være færdig først.
4. Tryk gem. Opgaven placeres automatisk i Gantt-diagrammet, og alt efter den rykker med.

---

## 2. Overblik over appen

Appen har fem faner:

| Fane | Hvad bruger du den til? |
|---|---|
| **Tidsplan** | Skift mellem **Gantt** (diagrammet) og **Opgaver** (listen, hvor du opretter og redigerer). Her findes også advarsler, baseline og PDF. |
| **Faggrupper** | Entrepriser og deres underressourcer (svende, lærlinge ...), timepriser og arbejdstider. |
| **Økonomi** | Sagspris, S-kurve, udgift pr. faggruppe og pr. opgave, ressourceoverblik pr. entreprise. |
| **Projekt & kalender** | Projektinfo, startdato, arbejdstid, etaper, helligdage og vejrstop. |
| **Vidensbase** | Ordliste med forklaring af begreber som kritisk vej, forgænger og buffer. |

Øverst finder du **Fortryd/Gentag**, **Nyt**, **Gem** (henter projektet som fil) og **Åbn** (indlæser en fil). Projektet gemmes også løbende i browseren, og status vises øverst.

---

## 3. Opgaver og afhængigheder

### Opret og rediger

I **Tidsplan → Opgaver** ligger alle opgaver som kort. **Ny opgave** og **Rediger** åbner et panel i højre side, så du ikke forlader overblikket. Escape lukker.

En opgave har:

- **Titel og beskrivelse**
- **Varighed** i *arbejdsdage* eller *timer* (se [kapitel 6](#6-arbejdstider-og-timeplanlægning))
- **Fast startdato** (valgfri). Opgaven starter tidligst denne dag.
- **Faggrupper**, evt. med **bemanding pr. aktivitet**
- **Etape** (valgfri)
- **Forgængere**
- **Weekend/helligdage:** som standard arbejdes der ikke i weekender og på helligdage. Det kan tillades pr. opgave.
- **Uvejr:** som standard stopper opgaven under vejrstop. Slå "uafhængig af uvejr" til for indendørsarbejde.
- **Fremdrift** i procent

### Forgængere

Opgaven starter, når **alle** dens forgængere tillader det. Du kan tilføje flere forgængere, hver med:

- **Type:** *Slut → Start* (efterfølgeren starter, når forgængeren er færdig) eller *Start → Start* (de starter sammen).
- **Forsinkelse:** et antal kalenderdage ventetid, fx 10 dage tørretid. Et negativt tal er et forspring.

Appen advarer og nægter at beregne, hvis opgaverne danner en cirkel (A venter på B, B venter på A).

### Kritisk vej

Opgaver, der bestemmer projektets slutdato, markeres med rød ramme og flamme. Forsinkes de, rykker slutdatoen. Opgaver uden flamme har luft.

### Søg, filtrér og gruppér

I opgavelisten kan du søge i titel, noter og faggruppe, filtrere på etape, faggruppe og "kun kritiske", gruppere efter etape og duplikere opgaver.

### Advarsler

Panelet **Advarsler** viser blandt andet:

- opgaver der slutter efter eller starter før deres etape
- opgaver uden faggruppe
- samme faggruppe på to opgaver samtidig (på klokkeslæt, hvis opgaverne er i timer)
- **overbelastning:** flere af en rolle på én gang, end entreprisen har
- opgaver der ikke kunne placeres

Klik på en advarsel for at åbne opgaven. Advarsler er vejledende; planen er stadig gyldig.

---

## 4. Gantt-diagrammet

Gantt viser alle opgaver som bjælker i faggruppens farve. Weekender er grønne, helligdage lilla (med 🇩🇰) og vejrstop blå (med ❄️).

**Flyt og ret**

- Træk i bjælken for at flytte startdatoen (sætter en fast start).
- Træk i højre kant for at ændre varigheden i dage.
- Med tastaturet: vælg en bjælke med Tab, piletaster flytter (Shift = 1 uge), **+ / −** ændrer varigheden, Enter åbner detaljer, op/ned skifter opgave.
- Klik en dag i kalenderhovedet for at tilføje eller fjerne en helligdag eller et vejrstop.

**Visning**

- **Zoom:** *Time* (06-18 pr. dag), *Dag*, *Uge* og *Måned*.
- **Fokusområde:** hele projektet, én etape, én måned eller ét år.
- **Hop:** *I dag*, *Projektstart*, *Projektslut*. En rød linje markerer i dag.
- **Afhængighedspile:** kan slås til og fra. Stiplede pile er Start → Start.
- **Fold etaper sammen:** pil ved hver etape, eller *Fold etaper sammen* / *Fold alle ud*. Det giver overblik i store projekter.

**Baseline**

Tryk **Gem baseline**, når planen er aftalt. Derefter vises den oprindelige plan som tynde skyggebjælker, afvigelsen i dage ved hver opgave, og Økonomi viser ændring i slutdato og sagspris. Tryk igen for at opdatere baseline.

---

## 5. Faggrupper, ressourcer og bemanding

### Faggrupper (entrepriser)

Under **Faggrupper** opretter du entrepriser som Tømrer, Murer eller El. Hver har:

- **Navn og farve**
- **Standard timepris** (kr./t)
- **Weekend- og helligdagstillæg** i procent
- **Fast pris:** i stedet for timepris kan en faggruppe have et engangsbeløb pr. opgave (fx kran eller container)

### Underressourcer (medarbejdere)

Under en faggruppe kan du tilføje **underressourcer**, fx:

| Rolle | Antal | kr./t |
|---|---|---|
| Overmontør | 1 | 620 |
| Svend | 2 | 460 |
| Lærling | 3 | 210 |

Panelet viser holdets samlede timepris. Faggruppens standardtakst bruges stadig på opgaver, der ikke er bemandet.

### Bemanding pr. aktivitet

I en opgave med en faggruppe, der har underressourcer, vises **Bemanding pr. aktivitet**. Del opgaven i aktiviteter og vælg, hvem der udfører dem:

- *Kabeltræk:* 2 lærlinge
- *Rillefræsning:* 1 svend
- *Planlægning og byggemøde:* 1 overmontør, 25 % af tiden

For hver aktivitet vælger du enten **en andel af tiden** (100 %, 75 % ... 10 %) eller **et fast antal timer pr. person**. Prisen beregnes ud fra rollernes timepriser, inklusive weekend- og helligdagstillæg. Appen advarer, hvis du bruger flere personer af en rolle, end faggruppen har.

### Ressourceoverblik

Under **Økonomi → Ressourceoverblik pr. entreprise** vælger du en entreprise (og evt. en etape) og ser:

- samlet pris
- timer, mandedage og pris pr. rolle
- pris pr. aktivitet
- pris for ubemandede opgaver
- de enkelte opgaver

---

## 6. Arbejdstider og timeplanlægning

### Arbejdstid for projektet

Under **Projekt & kalender → Arbejdstid** vælger du:

- **Enkel:** samme antal timer hver hverdag, fx 7,4 (standard). Opgaver placeres fra kl. 07:00.
- **Detaljeret:** klokkeslæt og pauser pr. ugedag. Der er tre rækker: *Man-tor*, *Fredag* og *Weekend*. Eksempel: man-tor 06:00-14:30 med pauser 9:00-9:15 og 11:30-12:00, fredag 06:00-14:00. Gennemsnittet pr. dag udregnes automatisk.

Weekend er som standard fri. Weekendtimerne bruges kun på opgaver, hvor du har tilladt weekendarbejde.

### Egne arbejdstider

- **Faggruppe:** under Faggrupper kan en faggruppe få egne arbejdstider. Opgaver for faggruppen placeres efter dem.
- **Rolle:** under hver underressource kan du angive egne arbejdstider (fx lærlinge der går tidligere). De bruges til lønberegning på opgaver i dage.

Hvis en opgave har flere faggrupper, følger placeringen den første faggruppe med egne arbejdstider, ellers projektets.

### Opgaver i timer

I opgaveformularen vælger du enheden **timer** i stedet for arbejdsdage, fx 4 timer til rillefræsning og 2 timer til oprydning.

- Opgaven placeres **på klokkeslæt** og springer pauser, weekender og helligdage over.
- En opgave, der følger efter en anden timeopgave, starter, hvor den slap. Rillefræsning 7:00-11:00 efterfølges altså af oprydning 11:00-13:00 samme dag.
- Passer opgaven ikke i resten af dagen, fortsætter den næste arbejdsdag.
- Du kan sætte et tidligste starttidspunkt sammen med en fast startdato.
- **Du kan blande opgaver i dage og timer i samme projekt.** Detaljér kun de opgaver, hvor det betyder noget.

I Gantt viser zoomen **Time** klokkeslæt. I zoomen kan du ikke trække i en timeopgaves kant. Brug **+ / −** på tastaturet (halve timer) eller redigér opgaven.

---

## 7. Etaper, milepæle og gentagende opgaver

**Etaper** (faser eller zoner) opretter du under *Projekt & kalender*. De får farve og tidsrum og bruges til at gruppere, filtrere, folde sammen og printe én etape ad gangen.

**Milepæle** er opgaver på 0 dage og vises som diamanter, fx godkendelser og delafleveringer. Slå "milepæl" til i opgaven.

**Gentagende opgaver** (fx ugentlig oprydning eller container) gentages med et fast interval i hele projektet eller udvalgte etaper. Angiv en pris pr. gang, så regnes de med i budgettet.

---

## 8. Kalender: helligdage og vejr

- **Helligdage:** danske helligdage beregnes automatisk for alle projektets år, inklusive reglen om Store Bededag (afskaffet fra 2024). Du kan tilføje egne lukkedage og ferieperioder.
- **Vejrstop:** registrér perioder med uvejr. Opgaver, der er vejrafhængige, forlænges og skubber efterfølgerne.

Begge dele findes under *Projekt & kalender*, og du kan også klikke direkte på en dag i Gantt.

---

## 9. Økonomi

Fanen **Økonomi** viser:

- **Total sagspris** og planlagt slutdato
- **Afvigelse mod baseline** (hvis gemt)
- **S-kurve** over de akkumulerede omkostninger
- **Udgift pr. faggruppe** og **pr. opgave**
- **Ressourceoverblik** pr. entreprise (se [kapitel 5](#5-faggrupper-ressourcer-og-bemanding))

Prisen følger timepris × timer pr. dag (eller klokketimer på timeopgaver), med tillæg for weekend og helligdage. Faste priser og gentagende ydelser regnes med. **Download PDF-rapport** udskriver økonomioversigten.

---

## 10. Print og PDF af hele tidsplanen

Under **Tidsplan** (Gantt) trykker du **Gem som PDF…**. Du får en vektor-PDF med skarp tekst i alle størrelser, velegnet til rulleprinter.

| Valg | Muligheder |
|---|---|
| **Omfang** | Hele projektet eller én etape ad gangen |
| **Papir** | Automatisk størrelse (ét stort ark) eller A4, A3, A2, A1, A0, liggende eller stående |
| **Opgaver pr. side** | Maks. 300 (kan sættes til 150, 75 eller 40). Etapens overskrift gentages med "(fortsat)". |
| **Detaljegrad** | 5, 3 eller 1,5 mm pr. dag ved automatisk størrelse |
| **Pile og baseline** | Kan slås til og fra |

Opgavenavn, faggruppe, datoer og varighed står ved hver bjælke, så der ikke er brug for en venstre kolonne. PDF'en har kalender (måneder, uger, dage, weekend, helligdage, vejr), titelfelt med projektinfo, signaturforklaring og sidetal. Dialogen viser et skøn over antal sider og format, før du gemmer.

Gode råd:

- En PDF-side kan højst være ca. 5 m. Bliver arket større, skaleres det automatisk ned. Vælg i så fald *Overblik* eller én etape ad gangen.
- Timeopgaver vises som dage i PDF'en, men klokkeslæt og timer står i teksten ved bjælken.
- Der er også **Hent som HTML** til en simpel version, du kan åbne og printe fra browseren.

---

## 11. Store projekter

- **Fold etaper sammen** i Gantt for overblik.
- **Vælg flere** i opgavelisten og ret etape, faggruppe (tilføj eller skift) eller varighed på alle valgte på én gang, eller slet dem. Alt kan fortrydes.
- **Indsæt fra Excel:** tryk *Indsæt fra Excel* i opgavelisten, kopiér rækker fra Excel og indsæt. Dialogen viser en forhåndsvisning og eventuelle bemærkninger, inden du tilføjer.

Kolonner genkendes på overskriften:

| Overskrift | Betydning |
|---|---|
| **Opgave** / Titel / Navn | Opgavens navn (påkrævet) |
| **Varighed** | Arbejdsdage. "2 uger" eller en kolonne med "uger" i overskriften regnes som 5 dage pr. uge. 0 giver en milepæl. |
| **Forgænger(e)** | ID, rækkenummer eller opgavens navn, adskilt med komma. Tilføj fx `SS+2` for Start → Start med 2 dages forskydning (`P04SS+2`). |
| **Faggruppe** | Findes den ikke, oprettes den. Flere adskilles med komma eller +. |
| **Etape** / Fase / Zone | Findes den ikke, oprettes den. |
| **Start** | Fast startdato, fx 5/8/2026 eller 2026-08-05 |
| **ID** | Dit eget id, som forgængere kan pege på |

Uden overskriftsrække bruges rækkefølgen: Opgave, Varighed, Forgænger, Faggruppe, Etape.

Appen er bygget til store projekter: Gantt tegner kun det synlige, og beregningen af tusindvis af sammenkædede opgaver tager brøkdele af et sekund.

---

## 12. Gem, åbn, fortryd og sikkerhedskopi

- **Automatisk gem:** projektet gemmes i din browser kort efter hver ændring. Status ses øverst ("Gemt i browseren kl. ...").
- **Gem / Åbn:** *Gem* henter projektet som en `.json`-fil, og *Åbn* indlæser en fil. Brug det til sikkerhedskopi, til at flytte projektet til en anden computer og til at dele det.
- **Sikkerhedskopi:** appen minder dig om at hente en kopi. Browserens lager kan blive ryddet, så hent en kopi jævnligt og ved vigtige milepæle.
- **Fortryd / Gentag:** Ctrl+Z og Ctrl+Shift+Z (eller Ctrl+Y), knapperne øverst eller "Fortryd" i beskeden efter en handling. Et helt træk i Gantt er ét trin.
- **Nyt projekt:** *Nyt* spørger først, så du ikke overskriver noget ved en fejl, og tilbyder at gemme det nuværende.

Projektet gemmes kun i din egen browser. Intet sendes til en server.

---

## 13. Genveje

| Genvej | Gør |
|---|---|
| Ctrl+Z | Fortryd |
| Ctrl+Shift+Z / Ctrl+Y | Gentag |
| Escape | Luk dialog eller sidepanel |
| Tab | Vælg næste bjælke i Gantt |
| ← → | Flyt valgt bjælke en dag (Shift: en uge) |
| + / − | Længere / kortere varighed (timeopgaver: halve timer) |
| Enter | Åbn detaljer for valgt bjælke |
| ↑ ↓ | Skift til opgaven over / under |

---

## 14. Spørgsmål og svar

**Min opgave starter senere, end jeg tror.**
Tjek forgængerne og eventuelle forsinkelser, om dagen er en weekend eller helligdag, om der er vejrstop, og om der er sat en fast startdato.

**Hvorfor kan jeg ikke trække i bjælkens kant?**
Opgaver i timer har ingen dagsvarighed at trække i. Redigér opgaven, eller brug + og − på tastaturet.

**Prisen passer ikke med timepris × dage.**
Hvis opgaven har bemanding, beregnes prisen ud fra rollerne i stedet. Weekend og helligdage har tillæg, og med egne arbejdstider bruges de faktiske timer.

**Hvad betyder "overbelastning"?**
Du har brugt flere svende (eller anden rolle) på samme tid, end faggruppen har ansat. Flyt opgaverne efter hinanden, eller ret antallet under Faggrupper.

**Jeg har mistet mit projekt.**
Er det slettet fra browseren, kan det kun hentes fra en fil, du har gemt. Brug *Gem* jævnligt.

**Kan flere arbejde i samme projekt?**
Ikke samtidigt. Gem projektet som fil og del den, så åbner modtageren den med *Åbn*.

**Virker æ, ø og å i PDF?**
Ja. PDF'en bruger en indbygget skrifttype med Latin-1, som dækker dansk. Specialtegn uden for Latin-1 kan ikke vises.

---

## 15. Til udviklere

* **Stak:** React 19, TypeScript (`strict`), Vite 6, Tailwind CSS 4, lucide-react, jsPDF (indlæses først, når PDF-dialogen bruges).
* **Planlægningsmotor:** `src/utils/scheduler.ts`. Datoer håndteres som hele dagsnumre og klokkeslæt som minutter, uden `Date`-objekter i de varme løkker. Opgaver beregnes i afhængighedsrækkefølge i ét gennemløb.
* **Test:** Node's indbyggede testløber.

```bash
npm ci          # installer afhængigheder
npm run dev     # start udviklingsserver
npm test        # kør tests
npm run lint    # typecheck (tsc)
npm run build   # produktionsbuild til dist/
```

Ved push til `main` bygger GitHub Actions appen og udgiver den på GitHub Pages.

---

*Tidsplaner er ikke statiske streger, men planer der påvirkes af vejr, helligdage, hold og faglige sammenhænge. Værktøjet er lavet til at gøre det synligt.*
