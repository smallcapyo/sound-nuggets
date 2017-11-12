import fetch from 'node-fetch'
import md5 from 'md5'
//import redis from '../server/redis.js'

const API_URL = 'https://openwhyd.org'

/*
  This service is abstracting the communication with the openwhyd api.
*/

// Api calls functions
const searchParams = (params) => {
  return Object.keys(params).map((key) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
  }).join('&')
}

const HEADERS = {
  'Origin': API_URL,
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,enq=0.8,frq=0.6',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Diggaz-frontend',
  'Content-Type': 'application/x-www-form-urlencoded charset=UTF-8',
  'Accept': 'text/html,application/xhtml+xml,application/xmlq=0.9,image/webp,image/apng,*/*q=0.8',
  'Cache-Control': 'max-age=0',
  'Referer': API_URL + '/login?action=logout',
  'Connection': 'keep-alive'
}

const dateFromObjectId = (objectId) => {
  return new Date(parseInt(objectId.substring(0, 8), 16) * 1000)
}

const post = (url, data, config = {}) => {
  const form = searchParams(data)
  const options = {
    ...config,
    body: form,
    method: 'POST',
    headers: {...HEADERS, ...config.headers}
  }

  return fetch(url, options)
}

const get = (url, config = {}) => {
  const options = {
    ...config,
    method: 'GET',
    headers: {...HEADERS, ...config.headers}
  }

  return fetch(url, options)
}

const getWithCookie = (url, cookie) => {
  const headers = {'Cookie': cookie}

  return get(url, {headers})
            .then((result) => result.json())
}

const postWithCookie = (url, data, cookie) => {
  const headers = {'Cookie': cookie}

  return post(url, data, {headers})
            .then((result) => result.json())
}

// TODO : set the cookie in a redis instance?
//        would avoid some requests, no db needed

const emailLogin = (email, password) => {
 const loginUrl = API_URL + '/login'

 return post(loginUrl, {
   action: 'login',
   ajax: true,
   email: email,
   md5: md5(password),
   includeUser: true
 })
 .then((result) => result.json())
 .then((json) => {
  redis.set(json._id, result.headers.get('set-cookie'))
  return json
 })
 .catch((e) => {
   console.error(e)
   return false
 })
}

const facebookLogin = (facebookId, facebookToken) => {
  const url = '${API_URL}/facebookLogin'

  return post(url, {
    ajax: true,
    fbUid: facebookId,
    fbAccessToken: facebookToken,
    includeUser: true
  })
  .then((result) => result.json())
  .then((json) => {
    redis.set(json._id, result.headers.get('set-cookie'))
    return json
  })
  .catch((e) => {
    console.error(e)
    return false
  })
}

const eidTable = {
  'sc': 'https://soundcloud.com/',
  'yt': 'https://www.youtube.com/watch?v=',
}

const providerTable = {
  'sc': 'soundcloud',
  'yt': 'youtube',
}

const eIdToURL = (spliteid) => {
  const provider = spliteid[1]

  if (provider == 'sc') { // TODO : more generic system?
    spliteid = spliteid.join('/').split('#')[0].split('/')
  }

  return eidTable[provider] + spliteid.slice(2).join('/')
}

const getUrl = (eId) => {
	if (eId.startsWith('/yt/')) {
		return 'https://www.youtube.com/watch?v=' + eId.split('/yt/')[1]
	}
	return ''
}

const getProvider = (eId) => {
	if (eId.startsWith('/yt/')) {
		return 'youtube'
	}
	if (eId.startsWith('/sc/')) {
		return 'soundcloud'
	}
	return ''
}

const toOpenwhydUrl = (url) => {
  // TODO : implement
  return {
    'src[id]': '',
    'src[name]': '',
    eId: '',
  }
}

const postTrack = () => {
  const url = '${API_URL}/api/post'
  const openwhydSrc = toOpenwhydSrc(track.url)

  const trackForm = {
    ...openwhydSrc,
    'name': track.name,
    'img': track.image,
    'pl[id]': track.playlist,
    'ctx': 'bk',
    'pl[name]': track.playlistName,
    'text': '',
    'action': 'insert',
  }

  return postWithCookie(url, trackForm, cookie)
            .then(console.log)
            .console.error(console.error)

}

const convertTrack = (openwhydTrack) => {
	if (!openwhydTrack) return {}
	return {
		_id: openwhydTrack._id,
		createdAt: dateFromObjectId(openwhydTrack._id),
		owner: openwhydTrack.uId,
		ownerName: openwhydTrack.uNm,
    ownerImage: `${API_URL}/img/u/${openwhydTrack.uId}`,
		playlist: openwhydTrack.pl ? openwhydTrack.pl.id : '',
		playlistName: openwhydTrack.pl ? openwhydTrack.pl.name : '',
		name: openwhydTrack.name,
		url: getUrl(openwhydTrack.eId),
		provider: getProvider(openwhydTrack.eId),
		image: openwhydTrack.img,
		originalOwner : null,
		originalOwnerName : "",
	}
}

const convertHotTrack = (track) => {
 return {
  ...convertTrack(track),
  position: track.prev === undefined || track.prev === track.score ? '=' :
            track.score > track.prev ? '>' : '<'
 }
}

const convertFollower = (follower) => {
  return {
    owner: follower.uId,
    ownerName: follower.uNm,
    ownerImage: `${API_URL}/img/u/${follower.uId}?width=100&height=100`
  }
}

const convertFollowed = (profileId) => {
  return (followed) => {
    return {
      owner: profileId,
      followed: followed.tId,
      followedName: followed.tNm,
      followedImage: `${API_URL}/img/u/${followed.tId}?width=100&height=100`
    }
  }
}

const convertSearchUrl = (url) => {
  const splitUrl = url.split('/')
  if (splitUrl[1] === 'u') {
    if (splitUrl[3] === 'playlist') {
      return `/profile/${splitUrl[2]}/playlists/${splitUrl[4]}`
    }
    return `/profile/${splitUrl[2]}/tracks`
  }

  return url
}

const getTrack = (openwhydUrl) => {
  const url = `${API_URL}${openwhydUrl}`
  return get(url)
          .then((result) => result.json())
          .then((track) => {
            return track.data.src.id
          })
          .catch(console.error)
}

// /c/ -> getTrackURL?
// /t/ ? -> getTrackURL?
const convertSearch = (limit) => {
  return (items, provider, type) => {
    if (!items) return []
    return items.slice(0, limit).map((item) => {
      const image = item.img.search('http') > -1 ?
                    item.img :
                    `${API_URL}${item.img}`
      return {
        apiProvider: 'openwhyd',
        _id: item.id,
        name: item.name,
        url: convertSearchUrl(item.url),
        image,
        provider,
        type,
      }
    })
  }
}

const getUser = (profileId) => {
  const url = `${API_URL}/api/user?id=${profileId}&includeSubscr=true&countPosts=true`

  return get(url)
        		.then((result) => result.json())
            .then((json) => {
              return {
                _id: profileId,
                name: json.name,
                image: json.img,
                text: json.text
              }
            })
            .catch(console.error)
}

if (Meteor.isServer) {
  Meteor.methods({
    'openwhyd.session.valid': (userId) => {
      return new Promise((resolve, reject) => {
        redis.get(userId, (err, reply) => {
          if (err) return reject(err)
          if (!reply ||
              cookie.parse(reply).date < Date.now())
            return resolve(false)
          return resolve(true)
        })
      })
      .catch(console.error)
    },

    'openwhyd.login.email': (email, password) => {
      emailLogin(email, password)
        .then(() => {
          
        })
        .catch(console.error)
    },

    'openwhyd.login.facebook': (facebookId) => {
      const url = `${API_URL}/facebookLogin`

      return openwhydRequest(login_url, {
              ajax: true,
              fbUid: user.services.facebook.id,
              fbAccessToken: user.services.facebook.accessToken,
              includeUser: true
      })
      .then((result) => {
      })
      .catch((e) => {
        console.error(e)
        return false
      })
    },

		'openwhyd.user.current.get': (cookie) => {
  		const url = `${API_URL}/api/user`

  		return getWithCookie(url, cookie)
            		.then((result) => result.json())
  		          .then((json) => {
									return {
                    currentUser: {
                      _id: json._id,
                      username: json.name,
                      image: json.img
                    },
                    username: json.name,
                    defaultPlaylist: {}, //TODO ??
                    isAuth: true,
									}
								})
  		          .catch(console.error)
		},

    'openwhyd.profile.tracks.post': postTrack,
    'openwhyd.profile.tracks.update': postTrack,

    'openwhyd.profile.tracks.delete': (trackId, cookie) => {
      const trackForm = {
        action : 'delete',
        _id: '5a001cbcaa2aa06454be3ef1'
      }

      return postWithCookie(url, trackForm, cookie)
              .then(console.log)
              .console.error(console.error)
    },

    'openwhyd.profile.stream.get': (profileId, limit) => {
      const url = `${API_URL}/?format=json&limit=${limit}`

      return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
                  return {
                    profileId,
                    tracks: json.map(convertTrack)
                  }
                })
                .catch(console.error)
    },

    'openwhyd.profile.playlists.post': (trackName, cookie) => {
      const playlistForm = {
        action : 'create',
        name: ''
      }

      return postWithCookie(url, playlistForm, cookie)
                .then(console.log)
                .catch(console.error)
    },

    'openwhyd.profile.playlists.update': (playlistId, name, cookie) => {
      const playlistForm = {
        action : 'rename',
        id: playlistId,
        name
      }

      return postWithCookie(url, playlistForm, cookie)
                .then(console.log)
                .catch(console.error)
    },

    'openwhyd.profile.playlists.delete': (playlistId, cookie) => {
      const playlistForm = {
        action : 'delete',
        id: playlistId
      }

      return postWithCookie(url, playlistForm, cookie)
                .then(console.log)
                .catch(console.error)
    },

    'openwhyd.profile.following.post': (followedId, cookie) => {
      const query = `?action=insert&tId=${followedId}&_=${Date.now()}`
      const url = `${API_URL}/api/follow${query}`

      return getWithCookie(url)
                .then(console.log)
                .catch(console.error)
    },

    'openwhyd.profile.following.delete': (profileId, limit) => {
      const query = `?action=delete&tId=${followedId}&_=${Date.now()}`
      const url = `${API_URL}/api/follow${query}`

      return getWithCookie(url)
                .then(console.log)
                .catch(console.error)
    },

    // public
    'openwhyd.search': (keywords, limit) => {
      // TODO : with and without cookie?
      const url = `${API_URL}/search?q=${keywords}&format=json&context=header&_=${Date.now()}`

      let limitedConvertSearch = convertSearch(limit)

      return get(url)
              .then((result) => result.json())
              .then((json) => {
                return [
                  ...limitedConvertSearch(json.results.user, 'user', 'user'),
                  ...limitedConvertSearch(json.results.track, 'track', 'track'),
//                  ...limitedConvertSearch(json.results.post, 'post', 'track'),
                  ...limitedConvertSearch(json.results.playlist, 'playlist', 'playlist'),
                ]
              })
              .catch(console.error)
    },

    // tracks
    'openwhyd.tracks.getOne': (openwhydUrl) => {
      const url = `${API_URL}${openwhydUrl}?format=json`

      // TODO : convert from eId to URL
      console.log('URL:', url)
      // FIXME : what to do if track cannot be found?
      // and why would i get a stranger result like this?
      // algolia index not up to date?

      return get(url)
              .then((result) => result.json())
              .then((track) => {
                console.log(track)
                return eIdToURL(track.eId.split('/'))
              })
              .catch(console.error)
    },

    'openwhyd.profile.tracks.hot.get': (limit, genre) => {
      const url = genre ?
                  `${API_URL}/hot/${genre}?format=json` :
                  `${API_URL}/hot?format=json&limit=${limit}`

      return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
                  return {
                    limit,
                    tracks: json.tracks.map(convertHotTrack)
                  }
                })
                .catch(console.error)
    },

    'openwhyd.profile.tracks.get': (profileId, limit, filter) => {
  		const url = filter ?
                  `${API_URL}/search?q=${filter}&uid=${profileId}&format=json&_=${Date.now()}` :
                  `${API_URL}/u/${profileId}?format=json&limit=${limit}`

  		return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
									return {
										profileId,
										limit,
										tracks: filter ? json.results.map(convertTrack).slice(0, limit + 1) :
																		 json.map(convertTrack),
									}
								})
  		          .catch(console.error)
		},

    // user
		'openwhyd.profile.user.get': (profileId) => {
  		const url = `${API_URL}/api/user?id=${profileId}&includeSubscr=true&countPosts=true`

  		return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
									return {
										profileId,
										stats: {
											tracks: json.nbPosts,
											playlists: json.pl.length,
											followers: json.nbSubscribers,
											following: json.nbSubscriptions,	
										}
									}
								})
  		          .catch(console.error)
		},

    // playlists
    'openwhyd.profile.playlists.get': (profileId) => {
  		const url = `${API_URL}/api/user?id=${profileId}`

  		return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
									return {
										profileId,
									  playlists: json.pl.map((playlist) => {
                      const playlistUid = playlist.url.split('/')[2] + '_' + playlist.id
                      return {
                        _id: playlist.id,
                        name: playlist.name,
                        image: `${API_URL}/img/playlist/${playlistUid}`,
                        tracksNbr: playlist.nbTracks
                      }
                    }).sort((a, b) => {
                      return a.name < b.name ? -1 :
                             a.name > b.name ?  1 : 0
                    })
									}
								})
  		          .catch(console.error)
    },

    'openwhyd.profile.playlists.tracks.get': (profileId, playlistId, limit, filter) => {
  		const url = `${API_URL}/u/${profileId}/playlist/${playlistId}?format=json&limit={limit}`

  		return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
                  return {
                    profileId,
                    limit,
                    tracks: json.map(convertTrack).slice(0, limit + 1)
                  }
								})
  		          .catch(console.error)
    },

    // followers
    'openwhyd.profile.followers.get': (profileId, limit, filter) => {
      const url = `${API_URL}/api/follow/fetchFollowers/${profileId}`

  		return get(url)
            		.then((result) => result.json())
                .then((json) => {
                  return {
                    profileId,
                    limit,
                    follows: json.map(convertFollower)
                  }
								})
  		          .catch(console.error)
    },

    // following
    'openwhyd.profile.following.get': (profileId, limit, filter) => {
      const url = `${API_URL}/api/follow/fetchFollowing/${profileId}`

  		return get(url)
            		.then((result) => result.json())
  		          .then((json) => {
                  return {
                    profileId,
                    limit,
                    follows: json.map(convertFollowed(profileId))
                  }
								})
  		          .catch(console.error)
    },    
  })
}
