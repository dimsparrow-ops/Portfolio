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
  { id: 'work', label: 'work', href: '/' },
  { id: 'about', label: 'about', href: '/about/' },
  { id: 'services', label: 'services', href: '/services/' },
  { id: 'lab', label: 'design lab', href: '/lab/' },
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
  { when: 'today · 2026', where: 'lisbon, pt', title: 'Placeholder — what I do now', text: 'Placeholder. One or two sentences about the current role and focus.' },
  { when: 'company · 2023 — 2026', where: 'remote', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.' },
  { when: 'company · 2020 — 2023', where: 'kyiv, ua', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.' },
  { when: 'company · 2017 — 2020', where: 'kyiv, ua', title: 'Placeholder role', text: 'Placeholder. What I owned, who I worked with, what shipped.' },
  { when: 'start · 2015', where: 'ua', title: 'Placeholder — where it started', text: 'Placeholder. The first design work.' },
];

/** Design Lab items. h = placeholder height ratio for the masonry. */
export const labItems = Array.from({ length: 14 }, (_, i) => ({
  title: `Experiment ${String(i + 1).padStart(2, '0')}`,
  h: [1.25, 0.8, 1, 1.4, 0.75, 1.1, 0.9, 1.3, 0.85, 1, 1.2, 0.7, 1.15, 0.95][i],
  hue: (i * 47 + 200) % 360,
  demo: i % 3 === 0,
}));
