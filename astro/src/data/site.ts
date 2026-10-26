export type NavItem = {
	label: string;
	href: string;
	children?: NavItem[];
};

export type ContentBlock = {
	title: string;
	kicker?: string;
	body: string[];
	points?: string[];
	cta?: {
		label: string;
		href: string;
		external?: boolean;
	};
};

export type PageHeroContent = {
	title: string;
	kicker?: string;
	text?: string;
	image?: string;
};

export type PhotoItem = {
	src: string;
	alt: string;
	className?: string;
};

export const site = {
	name: "Union Instrumentale Delémont",
	shortName: "UID",
	url: "https://fanfareuid.ch",
	description:
		"Site officiel de l'Union Instrumentale Delémont: news, agenda, harmonie, jeunesse et informations de contact.",
	address: "Rue du Temple 31, 2800 Delémont",
	email: "info@fanfareuid.ch",
};

export const navigation: NavItem[] = [
	{ label: "Accueil", href: "/" },
	{
		label: "Harmonie",
		href: "/harmonie/",
		children: [
			{ label: "Direction", href: "/harmonie/direction/" },
			{ label: "Comité", href: "/harmonie/comite/" },
			{ label: "Commission", href: "/harmonie/commission-de-musique/" },
		],
	},
	{
		label: "Jeunesse",
		href: "/jeunesse/",
		children: [
			{ label: "Union d’Avenir", href: "/jeunesse/union-davenir/" },
			{ label: "Les Lutins musiciens", href: "/jeunesse/lutins-musiciens/" },
			{ label: "Les Aventuriers", href: "/jeunesse/aventuriers/" },
		],
	},
	{ label: "Agenda", href: "/agenda/" },
	{ label: "Photos", href: "/photos/" },
	{ label: "Soutien", href: "/soutien/" },
	{ label: "Contact", href: "/contact/" },
];

export const pages = {
	harmonie: {
		title: "Harmonie",
		kicker: "Depuis 1878",
		body: [
			"L'Union Instrumentale Delémont est née le 6 janvier 1878 lors de la Fête des Rois sous la forme d'un chœur. Deux mois plus tard, une musique-fanfare voyait le jour sous le nom La jeune jurassienne.",
			"Aujourd'hui, la formation se décrit comme une harmonie: un orchestre mêlant bois, cuivres et percussion. Au fil des époques, les chefs successifs ont développé un répertoire riche et contrasté.",
			"La société met aussi un point d'honneur à créer de nouvelles générations de musiciens grâce à son école de musique pour les enfants dès 3 ans.",
		],
	},
	direction: {
		title: "La direction",
		kicker: "Biagio Musumeci",
		body: [
			"Depuis août 2025, Biagio Musumeci dirige l'ensemble. Originaire d'une petite ville près de Catane, en Sicile, il a suivi des cours de musique au conservatoire pendant ses études secondaires.",
			"Il a poursuivi un cycle de formation spécialisé au trombone à Paris, puis obtenu son bachelor à la Haute école de Lausanne fin 2016. Son parcours l'a ensuite conduit dans le Jura, où il a fondé une famille.",
			"Dès 2021, il suit une formation continue de trois ans en direction d'orchestre à la Haute école de Lucerne. Il poursuit actuellement sa formation avec le chef d'orchestre Jean-Claude Kolly.",
		],
	},
	comite: {
		title: "Faire vivre la société",
		kicker: "Coulisses",
		body: [
			"Telle la burette d'huile qui lubrifie coulisses et pistons, le comité œuvre à garantir la fluidité du déroulement d'une année UIDienne.",
			"Il s'occupe de la gestion de la société: membres, finances, contacts, uniformes, instruments, communication et organisation des manifestations.",
			"Le comité travaille en conjonction avec la commission de musique afin que les événements prévus et imprévus de la société se déroulent le mieux possible.",
		],
		points: [
			"Présidence — Guillaume Harris",
			"Vice-présidence et instruments — Sébastien Ermanni",
			"Secrétariat, Cadets et Aventuriers du Solfège — Florence Harris",
			"Finances et Lutins musiciens — Renaud Zbinden",
			"Commission de musique — Laetitia Lehmann",
			"Manifestations et tonnelle — Julien Brahier",
			"Local, matériel et transport — Damien Luginbühl",
		],
	},
	commission: {
		title: "Choisir et préparer le répertoire",
		kicker: "Répertoire",
		body: [
			"Le musicien doit avoir du plaisir à jouer: tel est l'objectif principal de la commission de musique.",
			"Elle est responsable de toute la partie musicale de la société, du choix de l'instrumentation et des morceaux à l'impression des partitions pour une quarantaine de membres.",
			"L'UID joue un répertoire varié, de la musique classique et moderne aux musiques de films, sans oublier des morceaux plus traditionnels comme les marches.",
		],
		points: [
			"Présidence — Laetitia Lehmann, saxophone",
			"Direction — Biagio Musumeci",
			"Membres — Henri-Philippe Degueldre, Moïra Schmidlin, Cathy Jeandupeux",
			"Archives — Guillaume Milani",
		],
	},
	unionDAvenir: {
		title: "Jouer et progresser ensemble",
		kicker: "Après la phase 1",
		body: [
			"Depuis août 2025, les jeunes musiciens de la Fanfare de Courtételle et de l’Union Instrumentale Delémont se sont réunis pour former ce nouvel ensemble. Il rassemble des jeunes de 8 à 18 ans jouant des instruments à vent et des percussions.",
			"Ils répètent le vendredi soir de 18h15 à 19h30 sous la direction de Marinel Mittempergher. Au début des vacances d’automne, un camp de quatre jours leur permet de préparer les concerts et concours de l’année.",
		],
		points: [
			"Répétition — vendredi, 18h15 à 19h30",
			"Contact — cadets@fanfareuid.ch (Union d'Avenir et Aventuriers)",
		],
	},
	aventuriers: {
		title: "Les premiers pas avec un instrument",
		kicker: "Dès 7 ans",
		body: [
			"Les Aventuriers rassemblent les jeunes de 7 ans et plus qui commencent leur formation avec l’instrument de leur choix.",
			"En plus de leurs cours individuels avec un professeur, ils se retrouvent chaque vendredi pour une heure de répétition en groupe avec leur directeur Biagio Musumeci.",
		],
		points: ["Répétition en groupe — chaque vendredi", "Contact — cadets@fanfareuid.ch)"],
		cta: {
			label: "Inscription aux Aventuriers",
			href: "https://docs.google.com/forms/d/e/1FAIpQLSediSYKFzgUQ0VNV6_AAhGTa3fydTvuevxOgsnC76kQs4voAA/viewform?usp=header",
			external: true,
		},
	},
	lutins: {
		title: "Découvrir la musique en jouant",
		kicker: "Dès 3 ans",
		body: [
			"Le Jardin musical fait découvrir aux enfants le monde de la musique dans un cadre ludique et régulier, une fois par semaine hors vacances scolaires.",
			"Pour le semestre d’août 2026 à janvier 2027, quatre classes sont ouvertes aux enfants de 3 à 6 ans au local UID, Rue du Temple 31 à Delémont.",
			"Les animatrices proposent une première approche de la musique par l'écoute, le mouvement, le chant et des activités pensées pour les plus petits.",
		],
		points: [
			"Quatre classes pour les enfants de 3 à 6 ans",
			"Contact: lutins.musiciens@fanfareuid.ch / 079 544 73 88",
		],
	},
};

export type ContentPageConfig = {
	title: string;
	description: string;
	hero: PageHeroContent;
	block: keyof typeof pages;
	image?: string | null;
	reverse?: boolean;
	className?: string;
};

export const contentPages = {
	harmonie: {
		title: "Harmonie",
		description: "Histoire et identité musicale de l'Union Instrumentale Delémont.",
		hero: {
			title: "Harmonie",
			kicker: "L'Instrum",
			text: "Une société née en 1878, aujourd'hui portée par une quarantaine de musiciennes et musiciens de 2e division.",
		},
		block: "harmonie",
		image: "/images/Photo_ensemble.jpg",
	},
	direction: {
		title: "Direction",
		description: "La direction de l'Union Instrumentale Delémont.",
		hero: {
			title: "La direction",
			kicker: "Biagio Musumeci",
			text: "Une direction musicale attentive au son, au groupe et à l'élan des générations.",
			image: "/images/biagio_musumeci.jpg",
		},
		block: "direction",
		image: "/images/biagio_musumeci.jpg",
		reverse: true,
	},
	comite: {
		title: "Comité",
		description: "Le comité de l'Union Instrumentale Delémont.",
		hero: {
			title: "Le comité",
			kicker: "Organisation",
			text: "La mécanique discrète qui permet à une année UIDienne de rester fluide.",
		},
		block: "comite",
		image: null,
	},
	commission: {
		title: "Commission de musique",
		description: "La commission de musique et le répertoire de l'UID.",
		hero: {
			title: "Commission de musique",
			kicker: "Répertoire",
			text: "Choisir les œuvres, préparer les partitions et garder le plaisir de jouer au centre.",
		},
		block: "commission",
		image: null,
		reverse: true,
	},
} satisfies Record<string, ContentPageConfig>;

export const lutinsSchedule = {
	classTimes: [
		"Mardi de 16h à 17h, goûter inclus",
		"Mardi de 17h15 à 18h",
		"Jeudi de 16h à 17h, goûter inclus",
		"Jeudi de 17h15 à 18h",
	],
	practicalDetails: [
		"Fréquence: une fois par semaine, hors vacances scolaires",
		"Semestre d'automne: août à janvier, inscription jusqu'au 30 juin",
		"Semestre de printemps: février à juillet, inscriptions ouvertes fin novembre 2026",
		"Prix: 120 CHF par enfant pour un semestre",
		"Lieu: Local UID, Rue du Temple 31, 2800 Delémont",
	],
};

export const lutinsAnimators = [
	{
		name: "Claudette Theurillat",
		text: "Je suis passionnée de musique et cheffe d’orchestre. J’ai suivi diverses formations dans le domaine musical et suis monitrice «J+M» (Jeunesse et Musique). J’ai à coeur de faire découvrir à vos enfants le monde merveilleux de la musique.",	},
	{
		name: "Matilde Studer",
		text: "Je suis enseignante et j’habite à Delémont. J’aime faire de la danse, du chant et des voyages. Je me réjouis d’apporter des activités et de vivre de bons moments musicaux avec vos enfants!",
	},
];

export const photoGallery: PhotoItem[] = [
	{
		src: "/images/Photo_ensemble.jpg",
		alt: "Musiciens de l’UID réunis en ensemble",
		className: "photo-wall__item--tall",
	},
	{
		src: "/images/cadets.jpg",
		alt: "Jeunes musiciens cadets devant le local de répétition",
		className: "photo-wall__item--wide",
	},
	{
		src: "/images/biagio_musumeci.jpg",
		alt: "Biagio Musumeci, directeur musical de l'UID",
		className: "photo-wall__item--portrait",
	},
	{
		src: "/images/lutins_musiciens_illustration.jpg",
		alt: "Illustration des Lutins musiciens",
		className: "photo-wall__item--wide",
	},
];
