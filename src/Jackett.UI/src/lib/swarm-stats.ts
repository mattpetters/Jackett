import type { SearchResult } from '@/types/jackett'

// These upstream definitions intentionally emit 1/1 when their source does not
// publish swarm statistics. Keep the sentinel out of the UI without changing
// Jackett's Torznab behavior for Sonarr/Radarr and other API consumers.
const INDEXERS_WITH_UNREPORTED_SWARM_STATS = new Set([
  '0magnet',
  '52bt',
  'acgrip',
  'anibt',
  'anisource',
  'audiobookbay',
  'bitmagnet',
  'blueroms',
  'btdirectory',
  'byrutor',
  'catorrent',
  'comicat',
  'crackingpatching',
  'damagnet',
  'divxtotal',
  'dontorrent',
  'epublibre',
  'erai-raws',
  'freejavtorrent',
  'gamestorrents',
  'hdrtorrent',
  'ildragonero',
  'internetarchive',
  'lostfilm',
  'mactorrentsdownload',
  'magnetcat',
  'magnetdownload',
  'magnetico',
  'makingoff',
  'mejortorrent',
  'metalguru',
  'mikan',
  'miobt',
  'mixtapetorrent',
  'newstudio',
  'newstudiol',
  'onejav',
  'pctorrent',
  'plugintorrent',
  'pornrips',
  'pornxlab',
  'proporno',
  'rintornet',
  'shanaproject',
  'showrss',
  'skidrowrepack',
  'subsplease',
  'torrentbyte',
  'torrentcore',
  'torrentkitty',
  'torrentoyunindir',
  'torrentsome',
  'torrenttip',
  'u3c3',
  'vsthouse',
  'vstorrent',
  'vsttorrents',
  'wolfmax4k',
])

export function hasReportedSwarmStats(release: SearchResult) {
  return !(
    INDEXERS_WITH_UNREPORTED_SWARM_STATS.has(release.TrackerId.toLocaleLowerCase()) &&
    release.Seeders === 1 &&
    release.Peers === 1
  )
}
