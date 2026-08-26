import type { IndexerProgress } from '@/types/jackett'

export interface IndexerDiagnosis {
  title: string
  description: string
  suggestions: string[]
}

export function diagnoseIndexerIssue(issue: IndexerProgress): IndexerDiagnosis {
  const message = issue.error?.toLocaleLowerCase() || ''

  if (issue.state === 'timed-out' || message.includes('timed out') || message.includes('timeout')) {
    return {
      title: 'The indexer did not respond in time',
      description: 'The site may be slow, blocked, or waiting on a protection challenge.',
      suggestions: ['Test the connection again', 'Open the tracker site to confirm it is online', 'Check FlareSolverr when the site uses Cloudflare'],
    }
  }

  if (message.includes('flaresolverr') || message.includes('cloudflare') || message.includes('challenge')) {
    return {
      title: 'Site protection could not be solved',
      description: 'Jackett reached the indexer but could not pass its anti-bot challenge.',
      suggestions: ['Confirm FlareSolverr is running', 'Test the indexer again', 'Check whether the configured site URL has changed'],
    }
  }

  if (['unauthorized', 'forbidden', 'login', 'cookie', 'credential', '401', '403'].some((term) => message.includes(term))) {
    return {
      title: 'Authentication needs attention',
      description: 'The tracker rejected the saved login, API key, or session cookie.',
      suggestions: ['Update the indexer credentials', 'Refresh an expired cookie', 'Test the connection after saving'],
    }
  }

  if (['name resolution', 'dns', 'no such host', 'connection refused', 'network is unreachable'].some((term) => message.includes(term))) {
    return {
      title: 'Jackett could not reach the tracker',
      description: 'This looks like a DNS, network, or tracker-address problem.',
      suggestions: ['Open the tracker site directly', 'Check the configured site URL', 'Retry after confirming network access'],
    }
  }

  if (message.includes('429') || message.includes('rate limit') || message.includes('too many requests')) {
    return {
      title: 'The tracker is rate limiting requests',
      description: 'The indexer is online but is temporarily rejecting frequent searches.',
      suggestions: ['Wait before testing again', 'Reduce repeated searches', 'Check the tracker account for API limits'],
    }
  }

  return {
    title: 'The indexer returned an error',
    description: 'Testing the connection usually reveals whether the problem is temporary or configuration-related.',
    suggestions: ['Test the connection', 'Review the complete error below', 'Edit the configuration if the test fails again'],
  }
}
