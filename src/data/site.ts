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
  { title: 'Research & strategy', hue: 212, text: 'Interviews, usability tests or competitor deep-dives, chosen to fit the question rather than a checklist. Then turning what I learn into product direction: priorities, a roadmap and a clear link to business goals.' },
  { title: 'Product design', hue: 28, text: 'No two products work the same way, so I start by digging into the numbers and the people behind them. Then I design end to end, looking for the point where what users need and what the business needs actually meet.' },
  { title: 'Enterprise UX', hue: 265, text: 'Workflows with dozens of edge cases, layered permissions and admin tools for people who use them eight hours a day. Complex on the inside, obvious on the outside.' },
  { title: 'Design systems', hue: 150, text: 'Components, tokens, accessibility and writing rules, shaped around how your teams actually work. Built to scale, documented to last.' },
  { title: 'Design engineering', hue: 190, text: 'Turning ideas into working things with AI: coded prototypes, internal tools and small products of my own, built faster than a spec could be written. AI is part of my everyday process, from research to shipping.' },
  { title: 'Design leadership', hue: 340, text: 'Owning the design outcome, not just the files: setting direction, making the hard calls and standing behind them. Keeping product, engineering and stakeholders aligned, and growing the designers around me through honest critique and 1:1s.' },
  { title: 'Uncharted problems', hue: 50, text: "If it's messy, unfamiliar or a little bit scary, I'm interested. The projects that stretch me are usually the ones I do best." },
];

/** About timeline, newest first. Regular sentence case; `when` is the mono label. */
export const timeline = [
  { when: 'Today · 2026 · Lisbon, Portugal', text: "I'm Dim. I live in Lisbon and design the kind of software nobody posts on Dribbble but everybody depends on: the systems behind schools, hospitals, banks and HR teams. My favourite moment is when something hopelessly complicated suddenly feels obvious." },
  { ai: true, when: 'AI · Ongoing · Everywhere', text: 'The day AI tools showed up, my curiosity went into overdrive. I poke at every new model, plug them into how I design, and build odd little experiments and real products with them. Half playground, half power tool.' },
  { when: 'Qubstudio · 2023 — Now · Lead Product Designer', text: "Several products walk into one login. I'm merging a US life-safety ecosystem used in schools and hospitals into a single platform. On the side: design systems for fintechs, an HR-tech redesign, and AI products. Check the main page." },
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
