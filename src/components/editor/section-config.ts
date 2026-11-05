import { nanoid } from 'nanoid'
import {
  certificateSchema,
  customItemSchema,
  educationSchema,
  languageSchema,
  projectSchema,
  skillSchema,
  workSchema,
} from '#/cv/schema'
import type { CvDoc } from '#/cv/schema'
import type { FieldType } from './fields'

export interface FieldDef {
  key: string
  label: string
  type?: FieldType
  placeholder?: string
  wide?: boolean
}

type AnyItem = { id: string; hidden: boolean } & Record<string, unknown>

export interface ListSectionDef {
  fields: FieldDef[]
  create: () => AnyItem
  summary: (item: AnyItem) => string
  addLabel: string
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const join = (...parts: unknown[]) => parts.map(s).filter(Boolean).join(' · ')

const dateFields: FieldDef[] = [
  { key: 'startDate', label: 'Start', placeholder: '2021-03' },
  { key: 'endDate', label: 'End', placeholder: 'blank = present' },
]

export const LIST_SECTIONS: Record<string, ListSectionDef> = {
  work: {
    addLabel: 'Add position',
    create: () => workSchema.parse({ id: nanoid(8) }),
    summary: (i) => join(i.position, i.name) || 'New position',
    fields: [
      { key: 'position', label: 'Title' },
      { key: 'name', label: 'Company' },
      { key: 'location', label: 'Location' },
      { key: 'url', label: 'Website' },
      ...dateFields,
      { key: 'summary', label: 'Summary', type: 'textarea' },
      { key: 'highlights', label: 'Highlights', type: 'lines' },
    ],
  },
  education: {
    addLabel: 'Add education',
    create: () => educationSchema.parse({ id: nanoid(8) }),
    summary: (i) => join(i.studyType, i.institution) || 'New education',
    fields: [
      { key: 'institution', label: 'Institution', wide: true },
      { key: 'studyType', label: 'Degree', placeholder: 'BSc' },
      { key: 'area', label: 'Field of study' },
      { key: 'location', label: 'Location' },
      { key: 'score', label: 'Grade / honours' },
      ...dateFields,
      { key: 'highlights', label: 'Highlights', type: 'lines' },
    ],
  },
  projects: {
    addLabel: 'Add project',
    create: () => projectSchema.parse({ id: nanoid(8) }),
    summary: (i) => s(i.name) || 'New project',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'url', label: 'Link' },
      ...dateFields,
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'highlights', label: 'Highlights', type: 'lines' },
    ],
  },
  skills: {
    addLabel: 'Add skill group',
    create: () => skillSchema.parse({ id: nanoid(8) }),
    summary: (i) => s(i.name) || 'New skill group',
    fields: [
      { key: 'name', label: 'Group', placeholder: 'Languages', wide: true },
      { key: 'keywords', label: 'Skills', type: 'csv', wide: true },
    ],
  },
  certificates: {
    addLabel: 'Add certification',
    create: () => certificateSchema.parse({ id: nanoid(8) }),
    summary: (i) => s(i.name) || 'New certification',
    fields: [
      { key: 'name', label: 'Name', wide: true },
      { key: 'issuer', label: 'Issuer' },
      { key: 'date', label: 'Date', placeholder: '2023-05' },
      { key: 'url', label: 'Link', wide: true },
    ],
  },
  languages: {
    addLabel: 'Add language',
    create: () => languageSchema.parse({ id: nanoid(8) }),
    summary: (i) => join(i.language, i.fluency) || 'New language',
    fields: [
      { key: 'language', label: 'Language' },
      { key: 'fluency', label: 'Fluency', placeholder: 'Native' },
    ],
  },
  custom: {
    addLabel: 'Add entry',
    create: () => customItemSchema.parse({ id: nanoid(8) }),
    summary: (i) => s(i.title) || 'New entry',
    fields: [
      { key: 'title', label: 'Title' },
      { key: 'subtitle', label: 'Subtitle' },
      { key: 'date', label: 'Date' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
}

/** Mutable access to a section's item array inside a draft doc. */
export function itemsOf(draft: CvDoc, key: string): AnyItem[] | undefined {
  if (key.startsWith('custom:')) {
    return draft.custom.find((c) => `custom:${c.id}` === key)?.items
  }
  const arr = (draft as unknown as Record<string, unknown>)[key]
  return Array.isArray(arr) ? (arr as AnyItem[]) : undefined
}

export function defFor(key: string): ListSectionDef | undefined {
  return key.startsWith('custom:') ? LIST_SECTIONS.custom : LIST_SECTIONS[key]
}

export type { AnyItem }
