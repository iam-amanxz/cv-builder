import { cvDocSchema } from './schema'
import type { CvDoc } from './schema'

/** Placeholder content so a fresh install shows a realistic preview. */
export function sampleDoc(): CvDoc {
  return cvDocSchema.parse({
    basics: {
      name: 'Alex Morgan',
      label: 'Senior Software Engineer',
      email: 'alex@example.com',
      phone: '+1 555 010 2030',
      url: 'alexmorgan.dev',
      location: 'Doha, Qatar',
      summary:
        'Full-stack engineer with 8 years of experience building web platforms used by millions. Focused on TypeScript, React and pragmatic backend design.',
      profiles: [
        {
          id: 'p1',
          network: 'GitHub',
          username: 'alexmorgan',
          url: 'github.com/alexmorgan',
        },
        {
          id: 'p2',
          network: 'LinkedIn',
          username: 'alexmorgan',
          url: 'linkedin.com/in/alexmorgan',
        },
      ],
    },
    work: [
      {
        id: 'w1',
        name: 'Acme Corp',
        position: 'Senior Software Engineer',
        location: 'Remote',
        startDate: '2022-03',
        endDate: '',
        highlights: [
          'Led migration of a monolith to a modular TypeScript platform, cutting deploy time from 40 to 6 minutes.',
          'Designed an event pipeline processing 12M events/day with 99.98% uptime.',
          'Mentored 5 engineers; introduced RFC process adopted across 4 teams.',
        ],
      },
      {
        id: 'w2',
        name: 'Globex',
        position: 'Software Engineer',
        location: 'Dubai, UAE',
        startDate: '2018-06',
        endDate: '2022-02',
        highlights: [
          'Built the customer dashboard (React, GraphQL) used by 300k monthly users.',
          'Reduced p95 API latency by 45% through query optimisation and caching.',
        ],
      },
    ],
    education: [
      {
        id: 'e1',
        institution: 'University of Example',
        studyType: 'BSc',
        area: 'Computer Science',
        startDate: '2014',
        endDate: '2018',
        score: 'First Class Honours',
      },
    ],
    projects: [
      {
        id: 'pr1',
        name: 'Open-source form library',
        url: 'github.com/alexmorgan/forms',
        description:
          'Type-safe form state library with 2k GitHub stars and 40 contributors.',
      },
    ],
    skills: [
      {
        id: 's1',
        name: 'Languages',
        keywords: ['TypeScript', 'Go', 'SQL', 'Python'],
      },
      {
        id: 's2',
        name: 'Frameworks',
        keywords: ['React', 'TanStack', 'Node.js', 'PostgreSQL'],
      },
    ],
    certificates: [
      {
        id: 'c1',
        name: 'AWS Solutions Architect – Associate',
        issuer: 'Amazon Web Services',
        date: '2023-05',
      },
    ],
    languages: [
      { id: 'l1', language: 'English', fluency: 'Native' },
      { id: 'l2', language: 'Arabic', fluency: 'Professional' },
    ],
    custom: [],
    meta: {},
  })
}
