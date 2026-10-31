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
  { title: 'Research & strategy', hue: 212, text: "We have strong opinions, a long backlog and zero evidence. Find out what our users actually struggle with, then turn it into a direction we can defend in front of the board." },
  { title: 'Product design', hue: 28, text: "Conversion is flat, users drop off halfway and nobody knows why. Dig into the numbers, talk to real users and design changes that actually move revenue. No templates, please." },
  { title: 'Enterprise UX', hue: 265, text: "We have seven products, seven logins, hundreds of edge cases and an admin panel only one person understands. Turn it all into one ecosystem that feels simple, without breaking anything." },
  { title: 'Design systems', hue: 150, text: "Five teams, five shades of blue, and every button is slightly different. Build us a system that lets us ship like one team, with docs people will actually read." },
  { title: 'Design engineering', hue: 190, text: "Skip the 30-page spec. Show me a working prototype by Friday so we can test the idea for real. Use whatever AI magic gets us there." },
  { title: 'Design leadership', hue: 340, text: "Our designers are talented, but nobody’s steering. Own the outcome, make the hard calls, get product and engineering on the same page, and help the team grow along the way." },
  { title: 'Uncharted problems', hue: 50, text: "We’re building something nobody has built before. No playbook, no precedent, no obvious answer. Are you in?" },
];

/** About timeline, newest first. Regular sentence case; `when` is the mono label. */
export const timeline = [
  { when: 'Today · 2026 · Lisbon, Portugal', text: "I'm Dim. I live in Lisbon and design the kind of software nobody posts on Dribbble but everybody depends on: the systems behind schools, hospitals, banks and HR teams." },
  { ai: true, when: 'AI · Ongoing · Everywhere', text: 'The day AI tools showed up, my curiosity went into overdrive. I poke at every new model, plug them into how I design, and build odd little experiments and real products with them. Half playground, half power tool.' },
  { when: 'Qubstudio · 2023 — Now · Lead Product Designer', text: "Several products walk into one login. I'm merging a US life-safety ecosystem used in schools and hospitals into a single platform, leading the design team that makes it happen. On the side: design systems for fintechs, an HR-tech redesign, and AI products. Check the main page." },
  { when: 'Qubstudio · 2021 — 2025 · Design Manager', text: 'Ten designers, countless 1:1s, and a competency matrix that turned “How do I grow?” into a map. Somewhere along the way I realized a team is just another system worth designing.' },
  { when: 'Qubstudio · 2020 — 2023 · Product Designer', text: 'The deep-end years: dashboards, SaaS platforms and mobile apps for fintech, healthcare and safety clients. Research, flows, pixels, handoff, repeat.' },
  { when: 'PettersonApps · 2017 — 2020 · UX Designer', text: "Wireframes, prototypes and usability tests where real people bravely tried my designs. That's where the fundamentals stuck." },
  { when: 'Thinkmobiles · 2016 — 2017 · Web Designer', text: 'First design job. First icons, first layouts, and a lot of watching senior designers work their magic.' },
];

/** Design Lab items. h = placeholder height ratio for the masonry. */
export const labItems = Array.from({ length: 14 }, (_, i) => ({
  title: `Experiment ${String(i + 1).padStart(2, '0')}`,
  h: [1.25, 0.8, 1, 1.4, 0.75, 1.1, 0.9, 1.3, 0.85, 1, 1.2, 0.7, 1.15, 0.95][i],
  hue: (i * 47 + 200) % 360,
  demo: i % 3 === 0,
}));
