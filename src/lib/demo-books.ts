import type { BookRecord } from "@/lib/types";

export type FolioBlock = {
  kicker?: string;
  heading?: string;
  drop?: string;
  body: string[];
  closing?: string;
};

export const DEMO_BOOKS: BookRecord[] = [
  {
    id: "demo-bestiary",
    title: "Bestiario de Thornvale",
    author: "Aldric el Iluminador",
    pageCount: 10,
    leather: "burgundy",
    kind: "manuscript",
    manuscriptKey: "bestiary",
    createdAt: 0,
    hasCover: true,
  },
  {
    id: "demo-chronicles",
    title: "Crónicas de Vesper",
    author: "Mira de la Pluma Gris",
    pageCount: 10,
    leather: "forest",
    kind: "manuscript",
    manuscriptKey: "chronicles",
    createdAt: 0,
    hasCover: true,
  },
  {
    id: "demo-herbarium",
    title: "Herbarium Arcana",
    author: "Hermana Elowen",
    pageCount: 10,
    leather: "forest",
    kind: "manuscript",
    manuscriptKey: "herbarium",
    createdAt: 0,
    hasCover: true,
  },
];

const BESTIARY: FolioBlock[] = [
  {
    kicker: "Ex libris",
    heading: "Del copista",
    body: [
      "Este volumen fue iluminado a la luz de cera en el invierno del año del Ciervo Blanco. Quien lo abra, que lo haga con las manos limpias y el ánimo atento: las criaturas aquí descritas no son meras fábulas.",
      "Si hallares este libro lejos de Thornvale, devuélvelo al scriptorium. El bosque recuerda a quienes extraen sus secretos y no los restituyen.",
    ],
  },
  {
    heading: "El Grifo de las Torres",
    drop: "E",
    body: [
      "n los riscos que coronan Thornvale anida el grifo, mitad águila de montaña y mitad león viejo. Sus plumas delanteras toman el color del cobre al atardecer; las garras traseras, el de la pizarra mojada.",
      "No ataca al caminante que baja la mirada y deja una ofrenda de carne seca en la piedra lisa. Ataca, en cambio, a quien señala su nido con el dedo, pues considera el gesto una declaración de caza.",
    ],
  },
  {
    heading: "El Vermis del Vado",
    drop: "B",
    body: [
      "ajo el puente de tres arcos duerme un vermis de agua, largo como tres carretas. Su lomo está cubierto de musgo, y los niños del pueblo lo confunden a veces con un tronco arrastrado por la crecida.",
      "Cuando el río baja, se oye un rumor como de piedra que roza piedra: es el animal acomodándose. Los pescadores no echan red en esa curva. Quien lo hace, recupera la red vacía y más pesada de lo que debería.",
    ],
  },
  {
    heading: "Los Trasgos del Roble Hueco",
    drop: "N",
    body: [
      "o son malvados, aunque sí ladrones de botones, cucharas y nombres olvidados. Viven en el roble que partió el rayo hace siete inviernos. Por la noche, si pegas el oído a la corteza, se oye una risa menuda.",
      "Se les compra la paz con miel y con silencio. Un cazador que gritó dentro del hueco despertó mudo al día siguiente, y no recuperó la voz hasta devolver una cuchara de estaño que juraba no haber tomado.",
    ],
  },
  {
    heading: "La Cierva de Niebla",
    drop: "A",
    body: [
      "parece solo en los amaneceres de helada, cuando el vaho de los prados aún no se ha levantado. No deja huella, o deja demasiadas, y las dos cosas son ciertas según quién cuente.",
      "Quien la sigue con avaricia se pierde. Quien la sigue con hambre de camino encuentra un sendero que no estaba en el mapa y, al cabo de un rato, su propia casa. El scriptorium no explica este último punto. Solo lo anota.",
    ],
  },
  {
    heading: "Nota al margen",
    body: [
      "Las iluminaciones de este cuaderno se copiaron de testimonios, no de cautiverios. Ninguna de estas criaturas ha sido traída al recinto. El copista considera que eso es una virtud, no una falta.",
      "Si el lector es cazador, que lea dos veces el folio del grifo. Si es niño, que no lea solo el de los trasgos, porque imitaremos su risa y luego nos faltarán las cucharas.",
    ],
  },
  {
    kicker: "Colofón",
    heading: "Fin del bestiario",
    body: [
      "Terminado a la octava vela. Piel de cordero, tinta de roble y oro de un anillo que ya no se lleva. Que el tomo sobreviva al copista.",
    ],
    closing: "Thornvale · Scriptorium menor",
  },
];

const CHRONICLES: FolioBlock[] = [
  {
    kicker: "Libro primero",
    heading: "De la fundación",
    body: [
      "Antes de llamarse Vesper, el valle era un paso de pastores y un rumor de campanas que nadie había fundido. Llegó una mujer con un candil y un contrato, y dijo que el anochecer merecía un reino, aunque fuera pequeño.",
      "Le creyeron porque el candil no se apagaba con el viento. Esa es la primera mentira útil de nuestra historia, y también la más hermosa.",
    ],
  },
  {
    heading: "La reina del candil",
    drop: "S",
    body: [
      "e llamaba Isera, y no era reina hasta que el valle se lo pidió. Rechazó corona de oro y aceptó una de hierro oscuro, para no olvidar el peso. Mandó alzar la primera torre no contra enemigos, sino contra el olvido: un archivo.",
      "En esa torre nació el hábito de escribir lo que se teme perder. Por eso estas crónicas existen. Por eso, lector, tienes un libro en las manos y no solo una hoguera de recuerdos.",
    ],
  },
  {
    heading: "El invierno de las siete nieves",
    drop: "C",
    body: [
      "ayó nieve en julio, y otra vez en agosto, y la gente dejó de contar las estaciones por el calendario y empezó a contarlas por el pan. Isera abrió los graneros y cerró las guerras menores. Nadie la amó tanto como ese año, ni la criticó tanto al siguiente.",
      "Un reino se mide, dice el archivo, no por sus estandartes sino por cuántos platos humean cuando el cielo se niega a cooperar.",
    ],
  },
  {
    heading: "La carta que no se envió",
    drop: "H",
    body: [
      "ay en el cajón tercero una carta de Isera a un hermano que quizá no existió. Habla de cansancio, de un candil que por fin parpadeó, y de un valle que ya no necesita que lo sostengan con las dos manos.",
      "No se envió. Se copió. El original se perdió en un incendio menor que el archivo insiste en llamar menor. La copia es esta, o es otra. Las crónicas son así: fieles y traidoras a la vez.",
    ],
  },
  {
    heading: "De los escribas",
    drop: "L",
    body: [
      "os escribas de Vesper juran no embellecer. Luego embellecen, porque la mano se acostumbra al ritmo de la frase y el oído del rey —o de la reina, o del concejo— prefiere un valle memorable a un valle exacto.",
      "Yo, Mira, anoto la costumbre para que el próximo copista no se crea el primero en pecar. La verdad cabe en un margen. La leyenda pide un tomo.",
    ],
  },
  {
    kicker: "Cierre",
    heading: "Hasta la próxima vela",
    body: [
      "Queda el reino. Queda el archivo. Queda el candil, o su idea. Si el lector vive en un tiempo donde Vesper es solo un nombre en un mapa viejo, sepa que un día alguien lo escribió para que no se apagara del todo.",
    ],
    closing: "Torre del Archivo · Vesper",
  },
];

const HERBARIUM: FolioBlock[] = [
  {
    kicker: "Prólogo",
    heading: "A quien recolecta",
    body: [
      "Este herbario no enseña a sanar por vanidad. Enseña a no confundir la hoja que calma con la hoja que calla para siempre. La diferencia, a veces, es un diente en el borde y un olor a lluvia vieja.",
      "Recolecta con la luna en menguante si buscas sueño. Con la luna en creciente si buscas fiebre que se vaya. Y nunca con prisa. Las plantas lo notan.",
    ],
  },
  {
    heading: "Hoja de luna",
    drop: "C",
    body: [
      "rece en los muros húmedos del claustro, plateada por el envés. Una infusión corta alivia el insomnio de los novicios; una infusión larga los hace hablar en sueños de personas que aún no conocen.",
      "Se seca a la sombra. El sol le roba el metal y deja solo hierba. Guardadla en lienzo, no en vidrio: el vidrio la vuelve amarga.",
    ],
  },
  {
    heading: "Raíz de ascua",
    drop: "B",
    body: [
      "ajo los tocones quemados, como si el incendio le hubiera enseñado el oficio. Al cortarla, el interior es del color de un carbón aún vivo. Un polvo mínimo en vino tinto devuelve el calor a quien volvió de la nieve.",
      "Demasiado polvo, y el calor no se va. Hubo un leñador que no escuchó la dosis y sudó hasta el alba. Vivió. No volvió a dudar de las monjas.",
    ],
  },
  {
    heading: "Salvia de los umbrales",
    drop: "S",
    body: [
      "e ata en ramilletes sobre las puertas en la noche de los difuntos. No ahuyenta a los muertos: les recuerda el camino de vuelta. Hay diferencia, y es importante.",
      "En infusión es vulgar y útil para la garganta. En humo es liturgia. No mezcléis los oficios.",
    ],
  },
  {
    heading: "El error del eléboro",
    drop: "E",
    body: [
      "léboro negro y eléboro verde se parecen al distraído. El verde es un aliado de la gota. El negro es una despedida. En este scriptorium hemos perdido a un hermano por una etiqueta mojada. Por eso ahora las etiquetas van cosidas, no pegadas.",
      "Si dudas, no uses. La duda es una hierba que no se cosecha y, aun así, salva más vidas que el resto del tomo.",
    ],
  },
  {
    kicker: "Cierre",
    heading: "Dejad el bosque en pie",
    body: [
      "Tomad poco. Dejad siempre una planta madre. Nombrad lo que cortáis, aunque sea en voz baja. El bosque no pide fe; pide cortesía.",
    ],
    closing: "Claustro de las Higueras",
  },
];

const MANUSCRIPTS: Record<string, FolioBlock[]> = {
  bestiary: BESTIARY,
  chronicles: CHRONICLES,
  herbarium: HERBARIUM,
};

export function getManuscriptFolios(key: string): FolioBlock[] {
  return MANUSCRIPTS[key] ?? BESTIARY;
}

export function isDemoId(id: string) {
  return id.startsWith("demo-");
}
