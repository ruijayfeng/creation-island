import type { Agent } from '@deepseek-ai/dsh-agent'
import type { JobRegistry } from '@deepseek-ai/dsh-jobs'

/** A project turn owns its background work until the actual processes settle. */
export async function stopOwnedJobs(jobs: JobRegistry, agent: Agent) {
  const live=jobs.list(agent).filter(job=>job.ownerSession===agent.session.id && ['running','stopping'].includes(job.status))
  for(const job of live) jobs.kill(job.id,agent,'Creation Island: project turn ended or was stopped')
  for(const job of live) {
    const result=await jobs.wait(job.id,15000,agent)
    if(['running','stopping'].includes(result.status)) throw new Error('background-stop')
  }
}
