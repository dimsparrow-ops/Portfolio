// Site-wide content. Imported from the old Framer portfolio (dimsi.framer.website); review before launch.

export const site = {
  name: 'Dim Sivetskyi',
  role: 'Lead Product Designer',
  email: 'dmsvtsk@gmail.com',
  resume: '/resume.pdf',
  location: 'Lisbon, PT',
};

export const socials = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/dimsi/' },
  { label: 'Instagram', href: 'https://www.instagram.com/dimsparrow/' },
];

export const stats = [
  { value: '8+', label: 'Years of experience' },
  { value: '40+', label: 'Completed projects' },
  { value: '10+', label: 'Designers mentored' },
  { value: '3', label: 'Teams led' },
];

/** Page order drives the direction of the horizontal page slide. */
export const pages = [
  { id: 'work', label: 'work', href: '/' },
  { id: 'about', label: 'about', href: '/about/' },
  { id: 'services', label: 'services', href: '/services/' },
  { id: 'lab', label: 'design lab', href: '/lab/' },
] as const;

export type PageId = (typeof pages)[number]['id'];
export const pageIndex = (id: PageId) => pages.findIndex((p) => p.id === id);

export const services = [
  { title: 'Research & strategy', hue: 212 },
  { title: '0 → 1 product design', hue: 28 },
  { title: 'UX/UI design', hue: 265 },
  { title: 'Design systems', hue: 150 },
  { title: 'Design management', hue: 340 },
];

export const serviceDetails = [
  'Competitor analysis',
  'User interviews',
  'Usability testing',
  'Concept prototyping',
  'Interaction design',
  'Accessibility',
  'Design systems & libraries',
  '1:1s and PDPs',
  'Career goals & growth',
];

/** About timeline, newest first. Accent = chip colour, like laurent.fyi. */
export const timeline = [
  { when: 'today · 2026', where: 'lisbon, pt', title: 'Lead Product Designer, Qubstudio', text: 'Leading product design for large SaaS platforms and systems — from research and strategy to design systems and delivery.' },
  { when: 'qubstudio · 3 years', where: 'remote', title: 'Design Manager', text: 'Led a team of 10 designers: regular 1:1s, feedback, growth plans and help with day-to-day challenges.' },
  { when: 'qubstudio', where: 'remote', title: 'Head of the Dribbble department', text: 'Built the whole Dribbble workflow, kept shots consistent with the brand and mentored designers on UI.' },
  { when: 'education', where: 'online', title: 'IBM Enterprise Design Thinking · Projector UX', text: 'Certified in Enterprise Design Thinking by IBM; graduate of the UX Medium course at Projector Institute.' },
  { when: 'start · 2016', where: 'ukraine', title: 'First design work', text: 'Started designing in Ukraine in 2016 — 40+ projects since.' },
];

/** Design Lab items. h = placeholder height ratio for the masonry. */
export const labItems = Array.from({ length: 14 }, (_, i) => ({
  title: `Experiment ${String(i + 1).padStart(2, '0')}`,
  h: [1.25, 0.8, 1, 1.4, 0.75, 1.1, 0.9, 1.3, 0.85, 1, 1.2, 0.7, 1.15, 0.95][i],
  hue: (i * 47 + 200) % 360,
  demo: i % 3 === 0,
}));
