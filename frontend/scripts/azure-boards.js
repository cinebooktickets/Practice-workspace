#!/usr/bin/env node
// scripts/azure-boards.js
// Azure DevOps work item automation for PrimeAssist frontend
//
// Required env:  AZURE_DEVOPS_PAT
// Optional env:  AZURE_DEVOPS_ORG     (default: PrimusLearningHub)
//                AZURE_DEVOPS_PROJECT  (default: Learning)
//
// Usage (frontend container running):
//   docker compose exec -e AZURE_DEVOPS_PAT=$AZURE_DEVOPS_PAT frontend \
//     node scripts/azure-boards.js <command> [options]
//
// Usage (no frontend container yet):
//   docker run --rm -e AZURE_DEVOPS_PAT=$AZURE_DEVOPS_PAT \
//     -v "$PWD/frontend/scripts:/scripts" node:20-alpine \
//     node /scripts/azure-boards.js <command> [options]

'use strict'

const https = require('https')
const fs    = require('fs')
const path  = require('path')

// board-ids.json lives next to this script
const IDS_FILE = path.join(__dirname, 'board-ids.json')

// Read the current IDs state
function readIds() {
  if (!fs.existsSync(IDS_FILE)) return {}
  try { return JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')) }
  catch { return {} }
}

// Write a single key/value into the IDs file
function saveId(key, value) {
  const state = readIds()
  state[key] = value
  fs.writeFileSync(IDS_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

// Auto-update the state field of any entry that matches the given work item ID
function updateIdState(id, newState) {
  const ids = readIds()
  let updated = false
  for (const key of Object.keys(ids)) {
    if (ids[key].id === id) {
      ids[key].state = newState
      updated = true
      break
    }
  }
  if (updated) fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf8')
  return updated
}

const ORG     = process.env.AZURE_DEVOPS_ORG     || 'PrimusLearningHub'
const PROJECT = process.env.AZURE_DEVOPS_PROJECT  || 'Learning'
const PAT     = process.env.AZURE_DEVOPS_PAT

if (!PAT) {
  console.error('Error: AZURE_DEVOPS_PAT environment variable is required')
  process.exit(1)
}

const AUTH        = Buffer.from(`:${PAT}`).toString('base64')
const API_VERSION = '7.1'
const TAGS        = 'PrimeAssist'

// Low-level HTTPS request
function request(method, url, body, contentType) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url)
    const bodyStr = body ? JSON.stringify(body) : null

    const options = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        Authorization: `Basic ${AUTH}`,
        Accept: 'application/json',
        ...(bodyStr && {
          'Content-Type':   contentType || 'application/json',
          'Content-Length': Buffer.byteLength(bodyStr),
        }),
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode >= 400) {
          let msg = `HTTP ${res.statusCode}`
          try { msg += `: ${JSON.parse(data).message || data}` }
          catch { msg += `: ${data.slice(0, 200)}` }
          reject(new Error(msg))
          return
        }
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })

    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// Azure DevOps hierarchy-parent link URL (org-scoped, no project)
function parentUrl(id) {
  return `https://dev.azure.com/${ORG}/_apis/wit/workItems/${id}`
}

// Create a work item (Epic, User Story, or Task)
async function createWorkItem(type, title, description, parentId, assignTo, estimate) {
  const ops = [
    { op: 'add', path: '/fields/System.Title', value: title },
    { op: 'add', path: '/fields/System.Tags',  value: TAGS  },
  ]

  if (description) {
    ops.push({ op: 'add', path: '/fields/System.Description', value: description })
  }

  if (assignTo) {
    ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignTo })
  }

  if (estimate) {
    const hrs = Number(estimate)
    ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate', value: hrs })
    ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',    value: hrs })
  }

  if (parentId) {
    ops.push({
      op:   'add',
      path: '/relations/-',
      value: {
        rel:        'System.LinkTypes.Hierarchy-Reverse',
        url:        parentUrl(parentId),
        attributes: { comment: '' },
      },
    })
  }

  const url = [
    `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}`,
    `/_apis/wit/workitems/$${encodeURIComponent(type)}`,
    `?api-version=${API_VERSION}`,
  ].join('')

  return request('POST', url, ops, 'application/json-patch+json')
}

// Update a work item (used for state transitions)
async function updateWorkItem(id, ops) {
  const url = [
    `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}`,
    `/_apis/wit/workitems/${id}`,
    `?api-version=${API_VERSION}`,
  ].join('')

  return request('PATCH', url, ops, 'application/json-patch+json')
}

// Post a discussion comment on a work item
async function addComment(id, text) {
  const url = [
    `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}`,
    `/_apis/wit/workItems/${id}/comments`,
    `?api-version=${API_VERSION}-preview.3`,
  ].join('')

  return request('POST', url, { text }, 'application/json')
}

// Get a single work item
async function getWorkItem(id) {
  const url = [
    `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJECT)}`,
    `/_apis/wit/workitems/${id}`,
    `?api-version=${API_VERSION}`,
  ].join('')

  return request('GET', url)
}

// Parse --key value pairs from argv
function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      args[argv[i].slice(2)] = argv[i + 1] ?? true
      i++
    }
  }
  return args
}

// Format work item for stdout
function fmt(item) {
  return {
    id:    item.id,
    type:  item.fields['System.WorkItemType'],
    title: item.fields['System.Title'],
    state: item.fields['System.State'],
    url:   item._links?.html?.href
        || `https://dev.azure.com/${ORG}/${PROJECT}/_workitems/edit/${item.id}`,
  }
}

async function main() {
  const [,, command, ...rest] = process.argv
  const opts = parseArgs(rest)

  switch (command) {

    case 'create-epic': {
      if (!opts.title) { console.error('--title is required'); process.exit(1) }
      const item   = await createWorkItem('Epic', opts.title, opts.description, null, opts.assignTo, opts.estimate)
      const result = fmt(item)
      console.log(JSON.stringify(result, null, 2))
      // --save <key>  e.g. --save phase1Epic
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'create-story': {
      if (!opts.title)    { console.error('--title is required');              process.exit(1) }
      if (!opts.parentId) { console.error('--parentId (Epic ID) is required'); process.exit(1) }
      const item   = await createWorkItem('User Story', opts.title, opts.description, Number(opts.parentId), opts.assignTo, opts.estimate)
      const result = fmt(item)
      console.log(JSON.stringify(result, null, 2))
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'create-task': {
      if (!opts.title)    { console.error('--title is required');                    process.exit(1) }
      if (!opts.parentId) { console.error('--parentId (User Story ID) is required'); process.exit(1) }
      const item   = await createWorkItem('Task', opts.title, opts.description, Number(opts.parentId), opts.assignTo, opts.estimate)
      const result = fmt(item)
      console.log(JSON.stringify(result, null, 2))
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'patch': {
      // Update fields on an existing work item
      if (!opts.id) { console.error('--id is required'); process.exit(1) }
      const ops = []
      if (opts.assignTo) {
        ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: opts.assignTo })
      }
      if (opts.estimate) {
        const hrs = Number(opts.estimate)
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate', value: hrs })
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',    value: hrs })
      }
      if (opts.remaining !== undefined) {
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork', value: Number(opts.remaining) })
      }
      if (opts.completed !== undefined) {
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: Number(opts.completed) })
      }
      if (opts.description) {
        ops.push({ op: 'add', path: '/fields/System.Description', value: opts.description })
      }
      if (opts.title) {
        ops.push({ op: 'add', path: '/fields/System.Title', value: opts.title })
      }
      if (ops.length === 0) { console.error('At least one of --title, --assignTo, --estimate, --remaining, --completed, --description is required'); process.exit(1) }
      const item   = await updateWorkItem(Number(opts.id), ops)
      const result = fmt(item)
      console.log(JSON.stringify(result, null, 2))
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'start': {
      if (!opts.id) { console.error('--id is required'); process.exit(1) }
      const ops = [
        { op: 'add', path: '/fields/System.State', value: 'Active' },
      ]
      if (opts.completed) {
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: Number(opts.completed) })
      }
      const item   = await updateWorkItem(Number(opts.id), ops)
      const result = fmt(item)
      if (opts.comment) await addComment(Number(opts.id), opts.comment)
      console.log(JSON.stringify(result, null, 2))
      updateIdState(Number(opts.id), 'Active')  // auto-update board-ids.json
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'close': {
      if (!opts.id) { console.error('--id is required'); process.exit(1) }
      const closeState = opts.state || 'Closed'
      const ops   = [
        { op: 'add', path: '/fields/System.State', value: closeState },
      ]
      if (opts.completed) {
        ops.push({ op: 'add', path: '/fields/Microsoft.VSTS.Scheduling.CompletedWork', value: Number(opts.completed) })
      }
      const item   = await updateWorkItem(Number(opts.id), ops)
      const result = fmt(item)
      if (opts.comment) await addComment(Number(opts.id), opts.comment)
      console.log(JSON.stringify(result, null, 2))
      updateIdState(Number(opts.id), closeState)  // auto-update board-ids.json
      if (opts.save) saveId(opts.save, result)
      break
    }

    case 'comment': {
      if (!opts.id)      { console.error('--id is required');      process.exit(1) }
      if (!opts.comment) { console.error('--comment is required'); process.exit(1) }
      await addComment(Number(opts.id), opts.comment)
      console.log(JSON.stringify({ id: Number(opts.id), commented: true }, null, 2))
      break
    }

    case 'get': {
      if (!opts.id) { console.error('--id is required'); process.exit(1) }
      const item = await getWorkItem(Number(opts.id))
      console.log(JSON.stringify(fmt(item), null, 2))
      break
    }

    case 'ids': {
      // Print the current board-ids.json contents
      console.log(JSON.stringify(readIds(), null, 2))
      break
    }

    case 'sync': {
      // Fetch live state for every entry in board-ids.json and update the file
      const ids  = readIds()
      const keys = Object.keys(ids)
      let updated = 0
      for (const key of keys) {
        const entry = ids[key]
        try {
          const item = await getWorkItem(entry.id)
          const live = fmt(item)
          if (ids[key].state !== live.state) {
            ids[key].state = live.state
            updated++
          }
        } catch (err) {
          console.error(`Warning: could not fetch #${entry.id}: ${err.message}`)
        }
      }
      fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf8')
      console.log(JSON.stringify({ synced: keys.length, updated }, null, 2))
      break
    }

    default:
      console.error([
        'Azure Boards automation — PrimeAssist frontend',
        '',
        'Usage: node scripts/azure-boards.js <command> [options]',
        '',
        'Commands:',
        '  create-epic   --title "PA | Phase N: ..."  [--assignTo "Name"]  [--estimate <hrs>]  [--save <key>]',
        '  create-story  --title "..."  --parentId <epicId>   [--assignTo "Name"]  [--estimate <hrs>]  [--save <key>]',
        '  create-task   --title "..."  --parentId <storyId>  [--assignTo "Name"]  [--estimate <hrs>]  [--save <key>]',
        '  start         --id <workItemId>  [--completed <hrs>]  [--comment "..."]  [--save <key>]',
        '  close         --id <workItemId>  [--state "Closed|Done"]  [--completed <hrs>]  [--comment "..."]  [--save <key>]',
        '  comment       --id <workItemId>  --comment "..."',
        '  patch         --id <workItemId>  [--title "..."]  [--description "..."]  [--assignTo "Name"]  [--estimate <hrs>]  [--completed <hrs>]',
        '  get           --id <workItemId>',
        '  ids           (print contents of board-ids.json)',
        '  sync          (fetch live state for all entries and rewrite board-ids.json)',
        '',
        'Required env: AZURE_DEVOPS_PAT',
        'Optional env: AZURE_DEVOPS_ORG (default: PrimusLearningHub)',
        '              AZURE_DEVOPS_PROJECT (default: Learning)',
        '',
        '--estimate <hrs>   sets Original Estimate + Remaining Work at creation',
        '--completed <hrs>  logs hours spent (on start or close)',
        '--save <key>       saves result into scripts/board-ids.json under that key',
      ].join('\n'))
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
