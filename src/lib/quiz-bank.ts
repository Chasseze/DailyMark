/**
 * The daily quiz question bank. Kept separate from the selection helpers so the
 * bank can grow without making the picker harder to read.
 *
 * Categories lean on durable facts — especially "Current Affairs", which is
 * world-institutions knowledge rather than last week's headlines — so a round
 * does not go stale between deploys.
 */

export type QuizCategory =
  | "Medicine"
  | "Science"
  | "Current Affairs"
  | "General Knowledge"
  | "History"
  | "Geography"
  | "Technology"
  | "Literature"
  | "Philosophy"
  | "Art"
  | "Math"
  | "Culture";

export interface QuizQuestion {
  id: string;
  text: string;
  category: QuizCategory;
  options: string[];
  answer: string;
  explain: string;
}

export const QUIZ_BANK: QuizQuestion[] = [
  // ── Medicine ────────────────────────────────────────────────────────────
  {
    id: "med-1",
    text: "Which organ produces insulin?",
    category: "Medicine",
    options: ["Liver", "Pancreas", "Kidney", "Spleen"],
    answer: "Pancreas",
    explain: "Beta cells in the islets of Langerhans secrete insulin.",
  },
  {
    id: "med-2",
    text: "What does CPR stand for?",
    category: "Medicine",
    options: [
      "Cardiac Pulse Recovery",
      "Cardiopulmonary Resuscitation",
      "Circulation Pressure Response",
      "Chest Pressure Revival",
    ],
    answer: "Cardiopulmonary Resuscitation",
    explain: "CPR combines chest compressions with rescue breaths to keep blood and oxygen moving.",
  },
  {
    id: "med-3",
    text: "Which blood type is known as the universal donor?",
    category: "Medicine",
    options: ["AB+", "A−", "O−", "B+"],
    answer: "O−",
    explain: "Type O negative lacks A, B and Rh antigens, so it can be given to most recipients in an emergency.",
  },
  {
    id: "med-4",
    text: "Vitamin C deficiency causes which disease?",
    category: "Medicine",
    options: ["Rickets", "Scurvy", "Beriberi", "Pellagra"],
    answer: "Scurvy",
    explain: "Without vitamin C the body cannot maintain collagen, which leads to scurvy.",
  },
  {
    id: "med-5",
    text: "Which part of the eye focuses light onto the retina?",
    category: "Medicine",
    options: ["Iris", "Cornea", "Lens", "Pupil"],
    answer: "Lens",
    explain: "The lens changes shape to focus images; the cornea does most of the fixed refraction.",
  },
  {
    id: "med-6",
    text: "Antibiotics are effective against which kind of pathogen?",
    category: "Medicine",
    options: ["Viruses", "Bacteria", "Prions", "All of the above"],
    answer: "Bacteria",
    explain: "Antibiotics target bacterial processes; they do not treat viral infections.",
  },

  // ── Science ─────────────────────────────────────────────────────────────
  {
    id: "sci-1",
    text: "Which planet is known as the Red Planet?",
    category: "Science",
    options: ["Venus", "Mars", "Jupiter", "Mercury"],
    answer: "Mars",
    explain: "Iron oxide on its surface gives Mars its rusty color.",
  },
  {
    id: "sci-2",
    text: "Which element has the chemical symbol 'O'?",
    category: "Science",
    options: ["Osmium", "Oxygen", "Gold", "Ozone"],
    answer: "Oxygen",
    explain: "Oxygen is atomic number 8 on the periodic table.",
  },
  {
    id: "sci-3",
    text: "What is the speed of light in a vacuum, roughly?",
    category: "Science",
    options: ["3,000 km/s", "30,000 km/s", "300,000 km/s", "3,000,000 km/s"],
    answer: "300,000 km/s",
    explain: "It is about 299,792 km per second — often rounded to 300,000.",
  },
  {
    id: "sci-4",
    text: "DNA is short for what?",
    category: "Science",
    options: [
      "Dynamic Nuclear Acid",
      "Deoxyribonucleic Acid",
      "Dual Nitrogen Assembly",
      "Dioxide Nucleic Alloy",
    ],
    answer: "Deoxyribonucleic Acid",
    explain: "DNA carries genetic instructions in nearly all living organisms.",
  },
  {
    id: "sci-5",
    text: "What force keeps planets in orbit around the Sun?",
    category: "Science",
    options: ["Magnetism", "Gravity", "Friction", "Centrifugal force"],
    answer: "Gravity",
    explain: "Newton's law of universal gravitation describes the pull between masses.",
  },
  {
    id: "sci-6",
    text: "Which gas makes up most of Earth's atmosphere?",
    category: "Science",
    options: ["Oxygen", "Carbon dioxide", "Nitrogen", "Argon"],
    answer: "Nitrogen",
    explain: "Nitrogen is about 78% of dry air; oxygen is about 21%.",
  },
  {
    id: "sci-7",
    text: "What is H₂O more commonly known as?",
    category: "Science",
    options: ["Hydrogen peroxide", "Water", "Ozone", "Salt"],
    answer: "Water",
    explain: "Two hydrogen atoms bonded to one oxygen atom make a water molecule.",
  },

  // ── Current Affairs / world institutions ────────────────────────────────
  {
    id: "aff-1",
    text: "Where is the headquarters of the United Nations?",
    category: "Current Affairs",
    options: ["Geneva", "New York City", "Vienna", "The Hague"],
    answer: "New York City",
    explain: "The UN Headquarters complex sits on the East River in Manhattan.",
  },
  {
    id: "aff-2",
    text: "What does WHO stand for?",
    category: "Current Affairs",
    options: [
      "World Health Organization",
      "Worldwide Humanitarian Office",
      "World Housing Order",
      "Western Health Outreach",
    ],
    answer: "World Health Organization",
    explain: "The WHO is the UN agency that coordinates international public health.",
  },
  {
    id: "aff-3",
    text: "How many permanent members sit on the UN Security Council?",
    category: "Current Affairs",
    options: ["3", "5", "7", "10"],
    answer: "5",
    explain: "China, France, Russia, the United Kingdom and the United States hold permanent seats.",
  },
  {
    id: "aff-4",
    text: "Which city hosts the International Court of Justice?",
    category: "Current Affairs",
    options: ["Brussels", "Geneva", "The Hague", "Paris"],
    answer: "The Hague",
    explain: "The ICJ sits in the Peace Palace in The Hague, Netherlands.",
  },
  {
    id: "aff-5",
    text: "The euro is the official currency of how many EU countries (as of the mid-2020s)?",
    category: "Current Affairs",
    options: ["12", "19", "20", "27"],
    answer: "20",
    explain: "Croatia adopted the euro in 2023, bringing the eurozone to 20 members.",
  },
  {
    id: "aff-6",
    text: "What does NATO stand for?",
    category: "Current Affairs",
    options: [
      "North Atlantic Treaty Organization",
      "Northern Allied Trade Office",
      "National Army Tactical Order",
      "Nordic Alliance Treaty Organization",
    ],
    answer: "North Atlantic Treaty Organization",
    explain: "NATO is a collective-defence alliance founded in 1949.",
  },

  // ── General Knowledge ───────────────────────────────────────────────────
  {
    id: "gk-1",
    text: "How many continents are generally recognized?",
    category: "General Knowledge",
    options: ["5", "6", "7", "8"],
    answer: "7",
    explain: "Africa, Antarctica, Asia, Europe, North America, South America and Australia/Oceania.",
  },
  {
    id: "gk-2",
    text: "What is the tallest mountain above sea level?",
    category: "General Knowledge",
    options: ["K2", "Kangchenjunga", "Mount Everest", "Lhotse"],
    answer: "Mount Everest",
    explain: "Everest rises about 8,849 metres on the Nepal–China border.",
  },
  {
    id: "gk-3",
    text: "How many colours are in a rainbow?",
    category: "General Knowledge",
    options: ["5", "6", "7", "8"],
    answer: "7",
    explain: "The traditional spectrum is red, orange, yellow, green, blue, indigo and violet.",
  },
  {
    id: "gk-4",
    text: "Which animal is known as the 'King of the Jungle'?",
    category: "General Knowledge",
    options: ["Tiger", "Lion", "Elephant", "Leopard"],
    answer: "Lion",
    explain: "Despite the nickname, lions live mainly on African savanna, not in jungle.",
  },
  {
    id: "gk-5",
    text: "How many degrees are in a full circle?",
    category: "General Knowledge",
    options: ["90", "180", "270", "360"],
    answer: "360",
    explain: "A complete rotation measures 360 degrees.",
  },
  {
    id: "gk-6",
    text: "Which instrument measures temperature?",
    category: "General Knowledge",
    options: ["Barometer", "Thermometer", "Hygrometer", "Altimeter"],
    answer: "Thermometer",
    explain: "A thermometer measures heat; a barometer measures air pressure.",
  },

  // ── History ─────────────────────────────────────────────────────────────
  {
    id: "his-1",
    text: "In which year did World War II end?",
    category: "History",
    options: ["1943", "1944", "1945", "1946"],
    answer: "1945",
    explain: "Germany surrendered in May 1945; Japan in September.",
  },
  {
    id: "his-2",
    text: "Who was the first person to walk on the Moon?",
    category: "History",
    options: ["Buzz Aldrin", "Yuri Gagarin", "Neil Armstrong", "Michael Collins"],
    answer: "Neil Armstrong",
    explain: "Armstrong stepped onto the lunar surface on 20 July 1969 during Apollo 11.",
  },
  {
    id: "his-3",
    text: "The Great Wall is primarily associated with which country?",
    category: "History",
    options: ["Japan", "China", "Mongolia", "Korea"],
    answer: "China",
    explain: "Sections were built across centuries to fortify China's northern borders.",
  },
  {
    id: "his-4",
    text: "Who was known as the 'Maid of Orléans'?",
    category: "History",
    options: ["Marie Antoinette", "Joan of Arc", "Catherine the Great", "Cleopatra"],
    answer: "Joan of Arc",
    explain: "Joan of Arc led French forces during the Hundred Years' War.",
  },
  {
    id: "his-5",
    text: "The Renaissance began in which country?",
    category: "History",
    options: ["France", "England", "Italy", "Spain"],
    answer: "Italy",
    explain: "It flowered first in Italian city-states such as Florence in the 14th century.",
  },

  // ── Geography ───────────────────────────────────────────────────────────
  {
    id: "geo-1",
    text: "What is the capital of Japan?",
    category: "Geography",
    options: ["Seoul", "Beijing", "Tokyo", "Bangkok"],
    answer: "Tokyo",
    explain: "Tokyo has been Japan's capital since 1868.",
  },
  {
    id: "geo-2",
    text: "Which ocean is the largest?",
    category: "Geography",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: "Pacific",
    explain: "The Pacific covers about one-third of Earth's surface.",
  },
  {
    id: "geo-3",
    text: "Which desert is the largest hot desert in the world?",
    category: "Geography",
    options: ["Gobi", "Kalahari", "Sahara", "Arabian"],
    answer: "Sahara",
    explain: "The Sahara spans much of North Africa; Antarctica is larger overall but cold.",
  },
  {
    id: "geo-4",
    text: "Which river is the longest in the world?",
    category: "Geography",
    options: ["Amazon", "Nile", "Yangtze", "Mississippi"],
    answer: "Nile",
    explain: "Most surveys still rank the Nile slightly longer than the Amazon.",
  },
  {
    id: "geo-5",
    text: "Mount Kilimanjaro is in which country?",
    category: "Geography",
    options: ["Kenya", "Tanzania", "Ethiopia", "Uganda"],
    answer: "Tanzania",
    explain: "Africa's highest peak rises in northeastern Tanzania.",
  },

  // ── Technology ──────────────────────────────────────────────────────────
  {
    id: "tech-1",
    text: "What does HTTP stand for?",
    category: "Technology",
    options: [
      "HyperText Transfer Protocol",
      "High Transfer Text Program",
      "Host Transfer Type Process",
      "Hyperlink Text Transport Path",
    ],
    answer: "HyperText Transfer Protocol",
    explain: "HTTP is the foundation of data communication on the web.",
  },
  {
    id: "tech-2",
    text: "How many bits are in a byte?",
    category: "Technology",
    options: ["4", "8", "16", "32"],
    answer: "8",
    explain: "A byte is conventionally 8 bits.",
  },
  {
    id: "tech-3",
    text: "Who co-founded Apple with Steve Jobs and Ronald Wayne?",
    category: "Technology",
    options: ["Bill Gates", "Steve Wozniak", "Larry Page", "Tim Berners-Lee"],
    answer: "Steve Wozniak",
    explain: "Wozniak designed the early Apple computers; Wayne left shortly after founding.",
  },
  {
    id: "tech-4",
    text: "What does CPU stand for?",
    category: "Technology",
    options: [
      "Central Processing Unit",
      "Computer Power Utility",
      "Core Program Upload",
      "Central Peripheral Unit",
    ],
    answer: "Central Processing Unit",
    explain: "The CPU executes instructions and is often called the computer's brain.",
  },
  {
    id: "tech-5",
    text: "Which company developed the Android operating system?",
    category: "Technology",
    options: ["Apple", "Microsoft", "Google", "Samsung"],
    answer: "Google",
    explain: "Google acquired Android Inc. in 2005 and released the first public version in 2008.",
  },

  // ── Literature ──────────────────────────────────────────────────────────
  {
    id: "lit-1",
    text: "Who wrote the novel '1984'?",
    category: "Literature",
    options: ["Aldous Huxley", "George Orwell", "Ray Bradbury", "Franz Kafka"],
    answer: "George Orwell",
    explain: "Orwell published Nineteen Eighty-Four in 1949.",
  },
  {
    id: "lit-2",
    text: "Who wrote 'Pride and Prejudice'?",
    category: "Literature",
    options: ["Charlotte Brontë", "Jane Austen", "Mary Shelley", "Emily Dickinson"],
    answer: "Jane Austen",
    explain: "Austen published it in 1813; Elizabeth Bennet is its protagonist.",
  },
  {
    id: "lit-3",
    text: "In which Shakespeare play does the line 'To be, or not to be' appear?",
    category: "Literature",
    options: ["Macbeth", "Othello", "Hamlet", "King Lear"],
    answer: "Hamlet",
    explain: "It opens Hamlet's soliloquy in Act 3, Scene 1.",
  },
  {
    id: "lit-4",
    text: "Who wrote 'The Odyssey'?",
    category: "Literature",
    options: ["Virgil", "Homer", "Sophocles", "Ovid"],
    answer: "Homer",
    explain: "The ancient Greek epic is traditionally attributed to Homer.",
  },

  // ── Philosophy ──────────────────────────────────────────────────────────
  {
    id: "phil-1",
    text: "Which philosopher said 'I think, therefore I am'?",
    category: "Philosophy",
    options: ["Plato", "René Descartes", "Aristotle", "Socrates"],
    answer: "René Descartes",
    explain: "Descartes wrote cogito, ergo sum in Discourse on the Method (1637).",
  },
  {
    id: "phil-2",
    text: "Who is traditionally credited with the Socratic method?",
    category: "Philosophy",
    options: ["Plato", "Aristotle", "Socrates", "Epicurus"],
    answer: "Socrates",
    explain: "Socrates taught by asking probing questions rather than lecturing.",
  },
  {
    id: "phil-3",
    text: "Which philosopher wrote 'The Republic'?",
    category: "Philosophy",
    options: ["Aristotle", "Plato", "Confucius", "Kant"],
    answer: "Plato",
    explain: "Plato's dialogue explores justice and the ideal city-state.",
  },

  // ── Art ─────────────────────────────────────────────────────────────────
  {
    id: "art-1",
    text: "Who painted the Mona Lisa?",
    category: "Art",
    options: ["Michelangelo", "Raphael", "Leonardo da Vinci", "Donatello"],
    answer: "Leonardo da Vinci",
    explain: "Leonardo painted it in the early 1500s; it hangs in the Louvre.",
  },
  {
    id: "art-2",
    text: "Which artist cut off part of his own ear?",
    category: "Art",
    options: ["Pablo Picasso", "Vincent van Gogh", "Claude Monet", "Edvard Munch"],
    answer: "Vincent van Gogh",
    explain: "Van Gogh injured his ear in Arles in 1888 during a period of mental distress.",
  },
  {
    id: "art-3",
    text: "The ceiling of the Sistine Chapel was painted by whom?",
    category: "Art",
    options: ["Leonardo da Vinci", "Raphael", "Michelangelo", "Caravaggio"],
    answer: "Michelangelo",
    explain: "Michelangelo painted it between 1508 and 1512 under commission from Pope Julius II.",
  },
  {
    id: "art-4",
    text: "Which Spanish artist co-founded Cubism with Georges Braque?",
    category: "Art",
    options: ["Salvador Dalí", "Pablo Picasso", "Francisco Goya", "Joan Miró"],
    answer: "Pablo Picasso",
    explain: "Picasso and Braque developed Cubism in the early 20th century.",
  },

  // ── Math ────────────────────────────────────────────────────────────────
  {
    id: "math-1",
    text: "What is the smallest prime number?",
    category: "Math",
    options: ["0", "1", "2", "3"],
    answer: "2",
    explain: "2 is the only even prime number.",
  },
  {
    id: "math-2",
    text: "What is the value of π (pi) rounded to two decimal places?",
    category: "Math",
    options: ["3.12", "3.14", "3.16", "3.18"],
    answer: "3.14",
    explain: "Pi is the ratio of a circle's circumference to its diameter ≈ 3.14159…",
  },
  {
    id: "math-3",
    text: "What is 7 × 8?",
    category: "Math",
    options: ["54", "56", "63", "64"],
    answer: "56",
    explain: "Seven eights are fifty-six.",
  },
  {
    id: "math-4",
    text: "A right angle measures how many degrees?",
    category: "Math",
    options: ["45", "60", "90", "180"],
    answer: "90",
    explain: "A right angle is a quarter of a full circle.",
  },

  // ── Culture ─────────────────────────────────────────────────────────────
  {
    id: "cul-1",
    text: "Which language is primarily spoken in Brazil?",
    category: "Culture",
    options: ["Spanish", "Portuguese", "French", "Italian"],
    answer: "Portuguese",
    explain: "Brazil was colonized by Portugal, unlike most of South America.",
  },
  {
    id: "cul-2",
    text: "Sushi originated in which country?",
    category: "Culture",
    options: ["China", "Korea", "Japan", "Thailand"],
    answer: "Japan",
    explain: "Modern sushi developed in Japan; vinegared rice is its defining base.",
  },
  {
    id: "cul-3",
    text: "Diwali is primarily a festival of which religion?",
    category: "Culture",
    options: ["Buddhism", "Hinduism", "Sikhism", "All of the above"],
    answer: "All of the above",
    explain: "Diwali is major in Hinduism and is also celebrated by many Sikhs, Jains and Buddhists.",
  },
  {
    id: "cul-4",
    text: "The tango originated in which region?",
    category: "Culture",
    options: ["Spain", "Cuba", "Argentina and Uruguay", "Mexico"],
    answer: "Argentina and Uruguay",
    explain: "It grew in the Río de la Plata ports of Buenos Aires and Montevideo.",
  },
];
