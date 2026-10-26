// Site-wide content. Everything here is placeholder until real copy arrives.

export const site = {
  name: 'Dim',
  role: 'Lead Product Designer',
  email: 'hello@example.com',
  resume: '/resume.pdf',
  location: 'Lisbon, PT',
};

/** Page order drives the direction of the horizontal page slide. */
export const pages = [
  { id: 'work', label: 'Work', href: '/' },
  { id: 'services', label: 'Services', href: '/services/' },
  { id: 'about', label: 'About', href: '/about/' },
  { id: 'lab', label: 'Design Lab', href: '/lab/' },
] as const;

export type PageId = (typeof pages)[number]['id'];
export const pageIndex = (id: PageId) => pages.findIndex((p) => p.id === id);

export const services = [
  { title: 'Product design', hue: 212 },
  { title: 'Design systems', hue: 265 },
  { title: 'Mobile apps', hue: 150 },
  { title: 'Web platforms', hue: 28 },
  { title: 'UX research', hue: 340 },
  { title: 'Prototyping', hue: 95 },
  { title: 'Design leadership', hue: 190 },
];

export const serviceDetails = [
  'User research',
  'Service blueprints',
  'Workshops',
  'UX / UI',
  'Prototyping',
  'Design systems',
  'Usability tests',
  'Team leadership',
];

/** About timeline, newest first. Accent = chip colour, like laurent.fyi. */
export const timeline = [
  { when: 'today · 2026', where: 'lisbon, pt', title: 'Placeholder — what I do now', text: 'Placeholder. One or two sentences about the current role and focus.', accent: '#26262b' },
  { when: 'company · 2023 — 2026', where: 'remote', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.', accent: '#2979ff' },
  { when: 'company · 2020 — 2023', where: 'kyiv, ua', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.', accent: '#ff2fae' },
  { when: 'company · 2017 — 2020', where: 'kyiv, ua', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.', accent: '#ffc400' },
  { when: 'start · 2015', where: 'ua', title: 'Placeholder — where it started', text: 'Placeholder. The first design work.', accent: '#00c853' },
];

/** Design Lab items. h = placeholder height ratio for the masonry. */
export const labItems = Array.from({ length: 14 }, (_, i) => ({
  title: `Experiment ${String(i + 1).padStart(2, '0')}`,
  h: [1.25, 0.8, 1, 1.4, 0.75, 1.1, 0.9, 1.3, 0.85, 1, 1.2, 0.7, 1.15, 0.95][i],
  hue: (i * 47 + 200) % 360,
  demo: i % 3 === 0,
}));
