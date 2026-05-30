#!/usr/bin/env python3
import argparse
import json
import os
import sys
from typing import Any, Dict, List


ORIGINAL_STDOUT = sys.stdout


SOURCE_MAP = {
    "apple": "AppleMusicClient",
    "deezer": "DeezerMusicClient",
    "5sing": "FiveSingMusicClient",
    "jamendo": "JamendoMusicClient",
    "joox": "JooxMusicClient",
    "kuwo": "KuwoMusicClient",
    "kugou": "KugouMusicClient",
    "migu": "MiguMusicClient",
    "netease": "NeteaseMusicClient",
    "qq": "QQMusicClient",
    "qianqian": "QianqianMusicClient",
    "qobuz": "QobuzMusicClient",
    "soundcloud": "SoundCloudMusicClient",
    "streetvoice": "StreetVoiceMusicClient",
    "soda": "SodaMusicClient",
    "spotify": "SpotifyMusicClient",
    "tidal": "TIDALMusicClient",
}

SOURCE_LABELS = {
    "AppleMusicClient": "苹果音乐",
    "DeezerMusicClient": "Deezer",
    "FiveSingMusicClient": "5sing",
    "JamendoMusicClient": "Jamendo",
    "JooxMusicClient": "Joox",
    "KuwoMusicClient": "酷我音乐",
    "KugouMusicClient": "酷狗音乐",
    "MiguMusicClient": "咪咕音乐",
    "NeteaseMusicClient": "网易云音乐",
    "QQMusicClient": "QQ音乐",
    "QianqianMusicClient": "千千音乐",
    "QobuzMusicClient": "Qobuz",
    "SoundCloudMusicClient": "SoundCloud",
    "StreetVoiceMusicClient": "StreetVoice",
    "SodaMusicClient": "汽水音乐",
    "SpotifyMusicClient": "Spotify",
    "TIDALMusicClient": "TIDAL",
}


def write_json(payload: Dict[str, Any], status: int = 0) -> None:
    ORIGINAL_STDOUT.write(json.dumps(payload, ensure_ascii=False))
    ORIGINAL_STDOUT.flush()
    raise SystemExit(status)


def load_musicdl():
    if os.environ.get("CLAWOS_MUSICDL_TEST_STUB") == "1":
        class StubClient:
            def __init__(self, music_sources=None, init_music_clients_cfg=None):
                self.music_sources = music_sources or []

            def search(self, keyword):
                return {
                    source: [{
                        "id": f"{source}-{keyword}",
                        "song_name": f"{keyword} 示例歌曲",
                        "singers": ["示例歌手"],
                        "album": "示例专辑",
                        "format": "FLAC",
                        "file_size": "32 MB",
                        "duration": "03:30",
                        "source": source,
                    }] for source in self.music_sources
                }

            def download(self, song_infos):
                return None

        class StubMusicdl:
            MusicClient = StubClient

        return StubMusicdl

    try:
        from musicdl import musicdl  # type: ignore
        return musicdl
    except Exception as error:
        write_json({
            "success": False,
            "error": "musicdl Python dependency is not installed. Run: pip install musicdl",
            "detail": str(error),
        }, 2)


def parse_sources(raw_sources: str) -> List[str]:
    sources: List[str] = []
    for item in raw_sources.split(','):
        key = item.strip()
        if not key:
            continue
        source = SOURCE_MAP.get(key, key)
        if source in SOURCE_LABELS and source not in sources:
            sources.append(source)
    return sources


def create_client(musicdl_module: Any, sources: List[str], limit: int, work_dir: str):
    init_cfg = {source: {"search_size_per_source": limit, "work_dir": work_dir} for source in sources}
    return musicdl_module.MusicClient(music_sources=sources, init_music_clients_cfg=init_cfg)


def normalize_song(song: Dict[str, Any], source_hint: str = "") -> Dict[str, Any]:
    if not isinstance(song, dict) and hasattr(song, "todict"):
        song = song.todict()
    source = str(song.get("source") or source_hint or "")
    song_name = song.get("song_name") or song.get("name") or song.get("title") or "未知歌曲"
    singers = song.get("singers") or song.get("singer") or song.get("artist") or []
    if isinstance(singers, list):
        artist = ", ".join(str(item) for item in singers if item)
    else:
        artist = str(singers or "未知歌手")
    album = song.get("album") or song.get("album_name") or "未知专辑"
    cover = ""
    for field in ["cover", "album_cover", "pic", "picture", "img", "image", "album_img", "album_pic", "cover_url", "pic_url"]:
        value = song.get(field)
        if isinstance(value, str) and value.startswith("http"):
            cover = value
            break
    file_format = ""
    for field in ["format", "ext", "file_format", "type"]:
        value = song.get(field)
        if value:
            file_format = str(value).upper()
            break
    return {
        "id": str(song.get("id") or song.get("songid") or song.get("songmid") or f"{source}:{song_name}:{artist}"),
        "title": str(song_name),
        "artist": artist,
        "album": str(album),
        "duration": str(song.get("duration") or ""),
        "fileSize": str(song.get("file_size") or song.get("filesize") or ""),
        "format": file_format or "未知",
        "source": source,
        "sourceLabel": SOURCE_LABELS.get(source, source or "未知来源"),
        "cover": cover,
        "raw": song,
    }


def search(args: argparse.Namespace) -> None:
    musicdl_module = load_musicdl()
    sources = parse_sources(args.sources)
    if not sources:
        write_json({"success": False, "error": "No valid music source selected"}, 1)
    client = create_client(musicdl_module, sources, args.limit, args.work_dir)
    results = client.search(keyword=args.keyword)
    songs: List[Dict[str, Any]] = []
    for source, source_results in (results or {}).items():
        if isinstance(source_results, list):
            for song in source_results:
                if isinstance(song, dict) or hasattr(song, "todict"):
                    songs.append(normalize_song(song, source))
    write_json({"success": True, "data": songs})


def download(args: argparse.Namespace) -> None:
    musicdl_module = load_musicdl()
    song_info_cls = None
    if os.environ.get("CLAWOS_MUSICDL_TEST_STUB") != "1":
        try:
            from musicdl.modules.utils.data import SongInfo  # type: ignore
            song_info_cls = SongInfo
        except Exception as error:
            write_json({"success": False, "error": f"Failed to load musicdl SongInfo: {error}"}, 2)

    songs = json.load(sys.stdin)
    if not isinstance(songs, list) or not songs:
        write_json({"success": False, "error": "No songs provided"}, 1)
    raw_songs = []
    sources = []
    for song in songs:
        if not isinstance(song, dict):
            continue
        raw = song.get("raw") if isinstance(song.get("raw"), dict) else song
        raw_song = song_info_cls.fromdict(raw) if song_info_cls else raw
        raw_songs.append(raw_song)
        source = raw.get("source") if isinstance(raw, dict) else None
        if isinstance(source, str) and source in SOURCE_LABELS and source not in sources:
            sources.append(source)
    if not raw_songs:
        write_json({"success": False, "error": "No valid songs provided"}, 1)
    if not sources:
        sources = parse_sources(args.sources)
    os.makedirs(args.work_dir, exist_ok=True)
    client = create_client(musicdl_module, sources, args.limit, args.work_dir)
    client.download(song_infos=raw_songs)
    write_json({"success": True, "data": {"count": len(raw_songs), "dir": args.work_dir}})


def main() -> None:
    parser = argparse.ArgumentParser(description="ClawOS musicdl worker")
    subparsers = parser.add_subparsers(dest="command", required=True)

    search_parser = subparsers.add_parser("search")
    search_parser.add_argument("--keyword", required=True)
    search_parser.add_argument("--sources", default="kuwo,kugou,migu")
    search_parser.add_argument("--limit", type=int, default=10)
    search_parser.add_argument("--work-dir", required=True)
    search_parser.set_defaults(func=search)

    download_parser = subparsers.add_parser("download")
    download_parser.add_argument("--sources", default="kuwo,kugou,migu")
    download_parser.add_argument("--limit", type=int, default=10)
    download_parser.add_argument("--work-dir", required=True)
    download_parser.set_defaults(func=download)

    args = parser.parse_args()
    args.limit = max(1, min(int(args.limit), 30))
    # musicdl and its clients print progress logs to stdout; keep stdout as a
    # machine-readable JSON channel for the Node caller.
    sys.stdout = sys.stderr
    args.func(args)


if __name__ == "__main__":
    main()
