import { useState } from "react";
import { Book, HelpCircle, AlertTriangle, Clock, Percent, Network, Layers, RefreshCcw, Landmark } from "lucide-react";

interface Term {
  title: string;
  icon: any;
  definition: string;
  explanation: string;
  example: string;
}

export function Glossary() {
  const [activeIdx, setActiveIdx] = useState<number>(0);

  const TERMS: Term[] = [
    {
      title: "Den Kritiske Vej (Critical Path)",
      icon: AlertTriangle,
      definition: "Den længste sammenhængende sekvens af afhængige opgaver i din tidsplan, der dikterer projektets endelige færdiggørelsesdato.",
      explanation: "Hvis en opgave på den kritiske vej bliver forsinket blot én enkelt dag, vil HELE projektets slutdato rykke sig en dag. Opgaver uden for den kritiske vej har 'slæk' (buffer) og kan forsinkes lidt uden at påvirke slutdatoen. I programmet genkender du den kritiske vej på det røde ild-ikon 🔥 og den røde ramme.",
      example: "Hvis du bygger et badeværelse, er opsætning af gipsplader og flisearbejde på den kritiske vej. At luge ukrudt i haven er ikke kritisk og kan vente.",
    },
    {
      title: "Mellem Opgaveafhængigheder (Finish-to-Start)",
      icon: Network,
      definition: "En logisk tidsmæssig sammenhæng mellem to opgaver, hvor efterfølgeren (successor) først kan starte efter forgængeren (predecessor) er færdig.",
      explanation: "Dette sikrer den praktiske rækkefølge på byggepladsen. Du kan ikke installere kontakter (stærkstrømsmontage), før mureren har pudset væggen op, og du kan ikke male før gipsvæggen er rejst og skruet.",
      example: "Opgave B ('Maling') afhænger af Opgave A ('Gipsplader'). Hvis Opgave A flyttes til højre på tidslinjen, skubbes Opgave B automatisk med for at overholde reglen.",
    },
    {
      title: "Etaper & Projektfaser (Stages)",
      icon: Layers,
      definition: "Overordnede, faste tidsintervaller i projektet (f.eks. 'Etape 1: Fundament'), som opgaver kan organiseres under.",
      explanation: "Etaper har urokkelige start- og slutdatoer og fungerer uafhængigt af opgavernes automatiske forskydninger. De danner de strukturelle grundpiller i byggeplanen. Almindelige opgaver kan tilknyttes en bestemt etape, hvilket gør det nemmere at bevare det overordnede strategiske overblik på Gantt-kortet.",
      example: "Etape 1 ('Kælderrum') varer fast fra 1. juli til 15. juli. Alle tilknyttede opgaver planlægges og visualiseres som en del af denne etape på Gantt-diagrammet.",
    },
    {
      title: "Tilbagevendende Opgaver (Recurring Tasks)",
      icon: RefreshCcw,
      definition: "Opgaver, der gentages automatisk med faste intervaller (f.eks. ugentligt sikkerhedstjek eller affaldshåndtering) og betales med en fast abonnements- eller enhedspris pr. gang.",
      explanation: "I stedet for at oprette mange ens særskilte opgaver, definerer du ét regelmæssigt interval i dage og en fast takst pr. udførelse. Hvis en udførelsesdag rammer en weekend eller en helligdag (uden at disse er godkendt), rykker systemet automatisk den specifikke dagsopgave til næste mulige arbejdsdag og fortsætter rytmen derfra.",
      example: "Affaldscontainertømning hver 6. dag til en fast enhedspris på 1.500 kr. pr. tømning. Hvis den 6. dag lander på en søndag, skubbes tømningen til mandag morgen uden at forstyrre projektets faste tidslinje.",
    },
    {
      title: "Weekend- og Helligdagstillæg",
      icon: Percent,
      definition: "En procentvis stigning i en faggruppes timepris, når der laves arbejde uden for normal hverdags-arbejdstid.",
      explanation: "For at beskytte svende og lærlinges fritid betaler man ekstra tillæg i weekenden og på søgnehelligdage. Standard weekendtillæg især inden for elektriker- eller murerfaget er ofte 50% til 100% ekstra i timen. I budgettet beregnes dette automatisk for hver dag, en opgave med 'Tillad weekendarbejde' slået til, strækker sig over en lørdag eller søndag.",
      example: "En elektriker svinger normalt til 300 kr/t. Ved weekendarbejde med 50% tillæg koster han 450 kr. i timen for bygherren. Det belaster din kasserapport ekstremt hurtigt!",
    },
    {
      title: "Fast Pris (IsFixedPrice) vs. Timepris",
      icon: Clock,
      definition: "To metoder til at afregne udgifterne for en faggruppes ydelser.",
      explanation: "Timepris afregnes løbende per arbejdsdag baseret på projektets 'Arbejdstimer pr. dag' (f.eks. 7.4 timer). Fast pris afregnes som et fast engangsbeløb en enkelt gang pr. tilknyttet opgave, uanset hvor mange arbejdsdage opgaven tager.",
      example: "Stilladsleje afregnes ofte som 'Fast pris' (f.eks. 8.000 kr. for leje, opsætning og nedtagning), mens tømrersvende og malere altid koster timepris per dag.",
    },
    {
      title: "Tidsbuffer & Slæk (Float / Slack)",
      icon: Landmark,
      definition: "Mængden af tid en opgave kan blive forsinket, uden at det påvirker projektets endelige afleveringsfrist.",
      explanation: "Opgaver, der ikke ligger på 'Den Kritiske Vej', har slæk. Jo mere slæk en opgave har, desto mindre sårbar er den. Ved at identificere opgaver med stor buffer kan du flytte arbejdskraft derfra over til pressede opgaver på den kritiske vej.",
      example: "Montering af dørhåndtag på kontoret kan vente i op til 14 dage (stor buffer) og gøres fleksibelt, mens lukning af tagkonstruktionen skal ske præcis til tiden (nul buffer).",
    },
  ];


  return (
    <div className="bg-white border border-slate-100 rounded-xl p-5 shadow-xs select-none">
      <div className="flex items-center gap-3 border-b border-slate-150 pb-3 mb-4">
        <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
          <Book className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-800">Projektledelsens Vidensbase</h3>
          <p className="text-xs text-slate-500">Forklaringer og faglige begreber beskrevet på en letforståelig måde</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Buttons list */}
        <div className="md:col-span-4 flex flex-col gap-2">
          {TERMS.map((term, i) => {
            const IconComp = term.icon;
            return (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                className={`p-3 rounded-lg border text-left text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                  activeIdx === i
                    ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                    : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                }`}
              >
                <IconComp className={`w-4 h-4 shrink-0 ${activeIdx === i ? "text-amber-400" : "text-slate-400"}`} />
                <span>{term.title}</span>
              </button>
            );
          })}
        </div>

        {/* Selected Term detail panel */}
        <div className="md:col-span-8 flex flex-col gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100 leading-relaxed text-xs">
          <div>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Faglig Definition:</span>
            <p className="text-slate-900 font-bold text-sm mt-0.5">{TERMS[activeIdx].definition}</p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Hvordan fungerer det i praksis?:</span>
            <p className="text-slate-600 mt-0.5">{TERMS[activeIdx].explanation}</p>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200">
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">Praktisk Eksempel:</span>
            <p className="text-slate-700 font-medium mt-0.5">{TERMS[activeIdx].example}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
