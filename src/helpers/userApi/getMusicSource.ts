import { httpFetch } from '@/components/utils/request';
import { headers } from '@/components/utils/musicSdk/options.js';
import { fakeAudioMp3Uri } from '@/constants/images';
import { b64DecodeUnicode, decodeName } from '@/components/utils';
import { DEV_URL_PREFIX, BACKUP_URL_PREFIX,KW_URL } from './third_party_url';
import { Alert } from 'react-native';

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
  return Promise.race([promise, timeout]);
};

const fetchWithTimeout = (url, options, timeout = 5000) => {
  console.log('----start----' + url);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Request timed out'));
    }, timeout);

    fetch(url, options)
      .then(response => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

const handleBackupFetch = async (songInfo, options, type, fakeAudioMp3Uri) => {
	// return fetchWithTimeout(backupUrl, options, 5000)
	//   .then((backupResponse) => parseResponse(backupResponse))
	//   .then((backupBody) => {
	//     if (!backupBody || !backupBody.data || !backupBody.data.src) {
	//       console.log('Backup fetch failed or no song_url in response');
	//       return { type, url: fakeAudioMp3Uri };
	//     }
	//     console.log('Backup fetch success:', backupBody.data.src);
	//     return { type, url: backupBody.data.src };
	//   })
	//   .catch((backupError) => {
	//     console.log('Backup fetch error:', backupError);
	//
	//     return { type, url: fakeAudioMp3Uri };
	//   });
  try {
  const url = await getMusicFromKw(songInfo, type)
	return { type, url: url };
  }
  catch (error ){
  console.log('Backup fetch error:', error);
 Alert.alert(
    "错误",
    "获取音乐失败，请稍后重试。",
    [
      { text: "确定", onPress: () => console.log("Alert closed") }
    ]
  );
  return { type, url: fakeAudioMp3Uri };

  }


};

export const myGetMusicUrl = (songInfo, type) => {
  const url = `${DEV_URL_PREFIX}${songInfo.id}/${type}`;
  const backupUrl = `${BACKUP_URL_PREFIX}${encodeURIComponent(songInfo.title)}&&n=1`;

  const options = {
    method: 'GET',
    headers: headers,  // Define your headers object
    family: 4,
    credentials: 'include',  // withCredentials: true equivalent in fetch
  };

  return fetchWithTimeout(url, options, 5000)
    .then((response) => parseResponse(response))
    .then((body) => {
      if (!body.data || (typeof body.data === 'string' && body.data.includes('error'))) {
        console.log('Fetch1 failed with error mp3');
        return handleBackupFetch(songInfo, options, type, fakeAudioMp3Uri);
      }
      console.log('获取成功1：' + body.data);
      return body.code === 0 ? { type, url: body.data } : null;
    })
    .catch((error) => {
      if (error.message === 'Request timed out') {
        console.log('Fetch1 error: Request timed out');
        return handleBackupFetch(songInfo, options, type, fakeAudioMp3Uri);
      }
      console.log('Fetch1 error:', error);
      return handleBackupFetch(songInfo, options, type, fakeAudioMp3Uri);
    });
};

const parseResponse = async (response) => {
  try {
    return await response.json();
  } catch (e) {
    try {
      if (response.status == 404) {
        return '404';
      }
      return await response.text();
    } catch (e) {
      console.log('Failed to parse response');
    }
  }
};

export const myGetLyric = async (musicItem) => {
  try {
    const requestObj = httpFetch(`https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${musicItem.id}&g_tk=5381&loginUin=0&hostUin=0&format=json&inCharset=utf8&outCharset=utf-8&platform=yqq`, {
      headers: {
        Referer: 'https://y.qq.com/portal/player.html',
      },
    });

    const { body } = await requestObj.promise;
    if (body.code !== 0 || !body.lyric) {
      throw new Error('Get lyric failed');
    }

    return {
      lyric: decodeName(b64DecodeUnicode(body.lyric)),
      tlyric: decodeName(b64DecodeUnicode(body.trans)),
    };

  } catch (error) {
    console.error('Error fetching lyrics:', error);
    throw error;
  }
};

export async function getTopListDetail(topListItem) {
  let _a;
  const res = await fetch(`https://u.y.qq.com/cgi-bin/musicu.fcg?g_tk=5381&data=%7B%22detail%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetDetail%22%2C%22param%22%3A%7B%22topId%22%3A${topListItem.id}%2C%22offset%22%3A0%2C%22num%22%3A100%2C%22period%22%3A%22${(_a = topListItem.period) !== null && _a !== void 0 ? _a : ''}%22%7D%7D%2C%22comm%22%3A%7B%22ct%22%3A24%2C%22cv%22%3A0%7D%7D`, {
    method: 'GET',
    headers: {
      Cookie: 'uin=',
    },
    credentials: 'include',
  }).then(res => res.json());

  return {
    ...topListItem,
    musicList: res.detail.data.songInfoList.map(formatMusicItem),
  };
}

function formatMusicItem(_) {
  let _a, _b, _c;
  const albumid = _.albumid || ((_a = _.album) === null || _a === void 0 ? void 0 : _a.id);
  const albummid = _.albummid || ((_b = _.album) === null || _b === void 0 ? void 0 : _b.mid);
  const albumname = _.albumname || ((_c = _.album) === null || _c === void 0 ? void 0 : _c.title);
  return {
    id: _.mid || _.songid,
    songmid: _.id || _.songmid,
    title: _.title || _.songname,
    artist: _.singer.map((s) => s.name).join(', '),
    artwork: albummid
      ? `https://y.gtimg.cn/music/photo_new/T002R800x800M000${albummid}.jpg`
      : undefined,
    album: albumname,
    lrc: _.lyric || undefined,
    albumid: albumid,
    albummid: albummid,
    url: 'Unknown',
  };
}

export async function getTopLists() {
  const list = await fetch('https://u.y.qq.com/cgi-bin/musicu.fcg?_=1577086820633&data=%7B%22comm%22%3A%7B%22g_tk%22%3A5381%2C%22uin%22%3A123456%2C%22format%22%3A%22json%22%2C%22inCharset%22%3A%22utf-8%22%2C%22outCharset%22%3A%22utf-8%22%2C%22notice%22%3A0%2C%22platform%22%3A%22h5%22%2C%22needNewCode%22%3A1%2C%22ct%22%3A23%2C%22cv%22%3A0%7D%2C%22topList%22%3A%7B%22module%22%3A%22musicToplist.ToplistInfoServer%22%2C%22method%22%3A%22GetAll%22%2C%22param%22%3A%7B%7D%7D%7D', {
    method: 'GET',
    headers: {
      Cookie: 'uin=',
    },
    credentials: 'include',
  }).then(res => res.json());

  return list.topList.data.group.map((e) => ({
    title: e.groupName,
    data: e.toplist.map((_) => ({
      id: _.topId,
      description: _.intro,
      title: _.title,
      period: _.period,
      coverImg: _.headPicUrl || _.frontPicUrl,
    })),
  }));
}

export async function getKwId(songInfo) {
  const encodedSongInfo = encodeURIComponent(songInfo.title+' '+songInfo.artist);
  const searchUrl = `https://search.kuwo.cn/r.s?client=kt&all=${encodedSongInfo}&pn=0&rn=25&uid=794762570&ver=kwplayer_ar_9.2.2.1&vipver=1&show_copyright_off=1&newver=1&ft=music&cluster=0&strategy=2012&encoding=utf8&rformat=json&vermerge=1&mobi=1&issubtitle=1`;
  console.log("searchUrl::::::" + searchUrl);

  try {
    // Make a request to the search URL
    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Parse the JSON response
    const data = await response.json();

    // Extract the DC_TARGETID from the first item in abslist
    if (data.abslist && data.abslist.length > 0) {
      const dcTargetId = data.abslist[0].DC_TARGETID;
      console.log("DC_TARGETID::::::" + dcTargetId);
      return dcTargetId;
    } else {
      throw new Error('No results found');
    }
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
  }
}
export async function getUrlFromKw(kwId:string, quality:string) {
  // Construct the source URL using the provided kwId and quality
	switch (quality){
		case 'flac':
			quality = '2000k'+quality
			break;
		case '128k':
			quality =quality+'mp3'
			break;
		case '320k':
			quality =quality+'mp3'
			break;
		default:
			quality = '128kmp3'
	}
  const sourceUrl = `${KW_URL}${kwId}&br=${quality}`;
  console.log("sourceUrl::::::" + sourceUrl);

  try {
    // Make a request to the source URL
    const response = await fetch(sourceUrl);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    // Read the response as text
    const responseText = await response.text();

    // Extract the URL from the response
    const urlMatch = responseText.match(/url=(https?:\/\/\S+)/);

    if (urlMatch && urlMatch[1]) {
      const url = urlMatch[1].trim(); // Trim any extra whitespace or newlines
      console.log("Extracted URL::::::" + url);
      return url;
    } else {
      throw new Error('URL not found in response');
    }
  } catch (error) {
    console.error('There has been a problem with your fetch operation:', error);
    return null; // Return null or handle the error as needed
  }
}
export async function getMusicFromKw(songInfo,quality:string){
	const  id =await getKwId(songInfo)
	const  url = await getUrlFromKw(id,quality)
	return url
}
