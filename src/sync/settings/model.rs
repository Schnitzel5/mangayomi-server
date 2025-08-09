use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Settings {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,

    #[serde(rename = "displayType")]
    pub display_type: i32,

    #[serde(rename = "libraryFilterMangasDownloadType")]
    pub library_filter_mangas_download_type: Option<i32>,

    #[serde(rename = "libraryFilterMangasUnreadType")]
    pub library_filter_mangas_unread_type: Option<i32>,

    #[serde(rename = "libraryFilterMangasStartedType")]
    pub library_filter_mangas_started_type: Option<i32>,

    #[serde(rename = "libraryFilterMangasBookMarkedType")]
    pub library_filter_mangas_book_marked_type: Option<i32>,

    #[serde(rename = "libraryShowCategoryTabs")]
    pub library_show_category_tabs: Option<bool>,

    #[serde(rename = "libraryDownloadedChapters")]
    pub library_downloaded_chapters: Option<bool>,

    #[serde(rename = "libraryShowLanguage")]
    pub library_show_language: Option<bool>,

    #[serde(rename = "libraryShowNumbersOfItems")]
    pub library_show_numbers_of_items: Option<bool>,

    #[serde(rename = "libraryShowContinueReadingButton")]
    pub library_show_continue_reading_button: Option<bool>,

    #[serde(rename = "libraryLocalSource")]
    pub library_local_source: Option<bool>,

    #[serde(rename = "sortLibraryManga")]
    pub sort_library_manga: Option<SortLibraryManga>,

    #[serde(rename = "sortChapterList")]
    pub sort_chapter_list: Option<Vec<SortChapter>>,

    #[serde(rename = "chapterFilterDownloadedList")]
    pub chapter_filter_downloaded_list: Option<Vec<ChapterFilterDownloaded>>,

    #[serde(rename = "chapterFilterUnreadList")]
    pub chapter_filter_unread_list: Option<Vec<ChapterFilterUnread>>,

    #[serde(rename = "chapterFilterBookmarkedList")]
    pub chapter_filter_bookmarked_list: Option<Vec<ChapterFilterBookmarked>>,

    #[serde(rename = "flexColorSchemeBlendLevel")]
    pub flex_color_scheme_blend_level: Option<f64>,

    #[serde(rename = "dateFormat")]
    pub date_format: Option<String>,

    #[serde(rename = "relativeTimesTamps")]
    pub relative_times_tamps: Option<i32>,

    #[serde(rename = "flexSchemeColorIndex")]
    pub flex_scheme_color_index: Option<i32>,

    #[serde(rename = "themeIsDark")]
    pub theme_is_dark: Option<bool>,

    #[serde(rename = "followSystemTheme")]
    pub follow_system_theme: Option<bool>,

    #[serde(rename = "incognitoMode")]
    pub incognito_mode: Option<bool>,

    #[serde(rename = "chapterPageUrlsList")]
    pub chapter_page_urls_list: Option<Vec<ChapterPageUrls>>,

    #[serde(rename = "showPagesNumber")]
    pub show_pages_number: Option<bool>,

    #[serde(rename = "chapterPageIndexList")]
    pub chapter_page_index_list: Option<Vec<ChapterPageIndex>>,

    #[serde(rename = "userAgent")]
    pub user_agent: Option<String>,

    #[serde(rename = "defaultReaderMode")]
    pub default_reader_mode: i32,

    #[serde(rename = "personalReaderModeList")]
    pub personal_reader_mode_list: Option<Vec<PersonalReaderMode>>,

    #[serde(rename = "animatePageTransitions")]
    pub animate_page_transitions: Option<bool>,

    #[serde(rename = "doubleTapAnimationSpeed")]
    pub double_tap_animation_speed: Option<i32>,

    #[serde(rename = "onlyIncludePinnedSources")]
    pub only_include_pinned_sources: Option<bool>,

    #[serde(rename = "pureBlackDarkMode")]
    pub pure_black_dark_mode: Option<bool>,

    #[serde(rename = "downloadOnlyOnWifi")]
    pub download_only_on_wifi: Option<bool>,

    #[serde(rename = "saveAsCBZArchive")]
    pub save_as_cbz_archive: Option<bool>,

    #[serde(rename = "concurrentDownloads")]
    pub concurrent_downloads: Option<i32>,

    #[serde(rename = "downloadLocation")]
    pub download_location: Option<String>,

    #[serde(rename = "filterScanlatorList")]
    pub filter_scanlator_list: Option<Vec<FilterScanlator>>,

    #[serde(rename = "autoExtensionsUpdates")]
    pub auto_extensions_updates: Option<bool>,

    #[serde(rename = "cropBorders")]
    pub crop_borders: Option<bool>,

    #[serde(rename = "locale")]
    pub locale: Option<L10nLocale>,

    #[serde(rename = "defaultSubtitleLang")]
    pub default_subtitle_lang: Option<L10nLocale>,

    #[serde(rename = "animeDisplayType")]
    pub anime_display_type: i32,

    #[serde(rename = "libraryFilterAnimeDownloadType")]
    pub library_filter_anime_download_type: Option<i32>,

    #[serde(rename = "libraryFilterAnimeUnreadType")]
    pub library_filter_anime_unread_type: Option<i32>,

    #[serde(rename = "libraryFilterAnimeStartedType")]
    pub library_filter_anime_started_type: Option<i32>,

    #[serde(rename = "libraryFilterAnimeBookMarkedType")]
    pub library_filter_anime_book_marked_type: Option<i32>,

    #[serde(rename = "animeLibraryShowCategoryTabs")]
    pub anime_library_show_category_tabs: Option<bool>,

    #[serde(rename = "animeLibraryDownloadedChapters")]
    pub anime_library_downloaded_chapters: Option<bool>,

    #[serde(rename = "animeLibraryShowLanguage")]
    pub anime_library_show_language: Option<bool>,

    #[serde(rename = "animeLibraryShowNumbersOfItems")]
    pub anime_library_show_numbers_of_items: Option<bool>,

    #[serde(rename = "animeLibraryShowContinueReadingButton")]
    pub anime_library_show_continue_reading_button: Option<bool>,

    #[serde(rename = "animeLibraryLocalSource")]
    pub anime_library_local_source: Option<bool>,

    #[serde(rename = "sortLibraryAnime")]
    pub sort_library_anime: Option<SortLibraryManga>,

    #[serde(rename = "pagePreloadAmount")]
    pub page_preload_amount: Option<i32>,

    #[serde(rename = "checkForAppUpdates")]
    pub check_for_app_updates: Option<bool>,

    #[serde(rename = "checkForExtensionUpdates")]
    pub check_for_extension_updates: Option<bool>,

    #[serde(rename = "scaleType")]
    pub scale_type: i32,

    #[serde(rename = "backgroundColor")]
    pub background_color: i32,

    #[serde(rename = "personalPageModeList")]
    pub personal_page_mode_list: Option<Vec<PersonalPageMode>>,

    #[serde(rename = "startDatebackup")]
    pub start_datebackup: Option<i32>,

    #[serde(rename = "backupFrequency")]
    pub backup_frequency: Option<i32>,

    #[serde(rename = "backupListOptions")]
    pub backup_list_options: Option<Vec<i32>>,

    #[serde(rename = "autoBackupLocation")]
    pub auto_backup_location: Option<String>,

    #[serde(rename = "usePageTapZones")]
    pub use_page_tap_zones: Option<bool>,

    #[serde(rename = "autoScrollPages")]
    pub auto_scroll_pages: Option<Vec<AutoScrollPages>>,

    #[serde(rename = "markEpisodeAsSeenType")]
    pub mark_episode_as_seen_type: Option<i32>,

    #[serde(rename = "defaultSkipIntroLength")]
    pub default_skip_intro_length: Option<i32>,

    #[serde(rename = "defaultDoubleTapToSkipLength")]
    pub default_double_tap_to_skip_length: Option<i32>,

    #[serde(rename = "defaultPlayBackSpeed")]
    pub default_play_back_speed: Option<f64>,

    #[serde(rename = "fullScreenPlayer")]
    pub full_screen_player: Option<bool>,

    #[serde(rename = "updateProgressAfterReading")]
    pub update_progress_after_reading: Option<bool>,

    #[serde(rename = "enableAniSkip")]
    pub enable_ani_skip: Option<bool>,

    #[serde(rename = "enableAutoSkip")]
    pub enable_auto_skip: Option<bool>,

    #[serde(rename = "aniSkipTimeoutLength")]
    pub ani_skip_timeout_length: Option<i32>,

    #[serde(rename = "btServerAddress")]
    pub bt_server_address: Option<String>,

    #[serde(rename = "btServerPort")]
    pub bt_server_port: Option<i32>,

    #[serde(rename = "fullScreenReader")]
    pub full_screen_reader: Option<bool>,

    #[serde(rename = "customColorFilter")]
    pub custom_color_filter: Option<CustomColorFilter>,

    #[serde(rename = "enableCustomColorFilter")]
    pub enable_custom_color_filter: Option<bool>,

    #[serde(rename = "colorFilterBlendMode")]
    pub color_filter_blend_mode: i32,

    #[serde(rename = "playerSubtitleSettings")]
    pub player_subtitle_settings: Option<PlayerSubtitleSettings>,

    #[serde(rename = "mangaHomeDisplayType")]
    pub manga_home_display_type: i32,

    #[serde(rename = "appFontFamily")]
    pub app_font_family: Option<String>,

    #[serde(rename = "mangaGridSize")]
    pub manga_grid_size: Option<i32>,

    #[serde(rename = "animeGridSize")]
    pub anime_grid_size: Option<i32>,

    #[serde(rename = "novelGridSize")]
    pub novel_grid_size: Option<i32>,

    #[serde(rename = "mangaExtensionsRepo")]
    pub manga_extensions_repo: Option<Vec<Repo>>,

    #[serde(rename = "animeExtensionsRepo")]
    pub anime_extensions_repo: Option<Vec<Repo>>,

    #[serde(rename = "novelExtensionsRepo")]
    pub novel_extensions_repo: Option<Vec<Repo>>,

    #[serde(rename = "disableSectionType")]
    pub disable_section_type: i32,

    #[serde(rename = "useLibass")]
    pub use_libass: Option<bool>,

    #[serde(rename = "hwdecMode")]
    pub hwdec_mode: Option<String>,

    #[serde(rename = "libraryFilterNovelDownloadType")]
    pub library_filter_novel_download_type: Option<i32>,

    #[serde(rename = "libraryFilterNovelUnreadType")]
    pub library_filter_novel_unread_type: Option<i32>,

    #[serde(rename = "libraryFilterNovelStartedType")]
    pub library_filter_novel_started_type: Option<i32>,

    #[serde(rename = "libraryFilterNovelBookMarkedType")]
    pub library_filter_novel_book_marked_type: Option<i32>,

    #[serde(rename = "novelLibraryShowCategoryTabs")]
    pub novel_library_show_category_tabs: Option<bool>,

    #[serde(rename = "novelLibraryDownloadedChapters")]
    pub novel_library_downloaded_chapters: Option<bool>,

    #[serde(rename = "novelLibraryShowLanguage")]
    pub novel_library_show_language: Option<bool>,

    #[serde(rename = "novelLibraryShowNumbersOfItems")]
    pub novel_library_show_numbers_of_items: Option<bool>,

    #[serde(rename = "novelLibraryShowContinueReadingButton")]
    pub novel_library_show_continue_reading_button: Option<bool>,

    #[serde(rename = "novelLibraryLocalSource")]
    pub novel_library_local_source: Option<bool>,

    #[serde(rename = "sortLibraryNovel")]
    pub sort_library_novel: Option<SortLibraryManga>,

    #[serde(rename = "novelDisplayType")]
    pub novel_display_type: i32,

    #[serde(rename = "novelFontSize")]
    pub novel_font_size: Option<i32>,

    #[serde(rename = "novelTextAlign")]
    pub novel_text_align: i32,

    #[serde(rename = "navigationOrder")]
    pub navigation_order: Option<Vec<String>>,

    #[serde(rename = "hideItems")]
    pub hide_items: Option<Vec<String>>,

    #[serde(rename = "clearChapterCacheOnAppLaunch")]
    pub clear_chapter_cache_on_app_launch: Option<bool>,

    #[serde(rename = "lastTrackerLibraryLocation")]
    pub last_tracker_library_location: Option<String>,

    #[serde(rename = "mergeLibraryNavMobile")]
    pub merge_library_nav_mobile: Option<bool>,

    #[serde(rename = "enableDiscordRpc")]
    pub enable_discord_rpc: Option<bool>,

    #[serde(rename = "hideDiscordRpcInIncognito")]
    pub hide_discord_rpc_in_incognito: Option<bool>,

    #[serde(rename = "rpcShowReadingWatchingProgress")]
    pub rpc_show_reading_watching_progress: Option<bool>,

    #[serde(rename = "rpcShowTitle")]
    pub rpc_show_title: Option<bool>,

    #[serde(rename = "rpcShowCoverImage")]
    pub rpc_show_cover_image: Option<bool>,

    #[serde(rename = "useMpvConfig")]
    pub use_mpv_config: Option<bool>,

    #[serde(rename = "debandingType")]
    pub debanding_type: Option<i32>,

    #[serde(rename = "enableGpuNext")]
    pub enable_gpu_next: Option<bool>,

    #[serde(rename = "useYUV420P")]
    pub use_yuv420p: Option<bool>,

    #[serde(rename = "audioPreferredLanguages")]
    pub audio_preferred_languages: Option<String>,

    #[serde(rename = "enableAudioPitchCorrection")]
    pub enable_audio_pitch_correction: Option<bool>,

    #[serde(rename = "audioChannels")]
    pub audio_channels: Option<i32>,

    #[serde(rename = "volumeBoostCap")]
    pub volume_boost_cap: Option<i32>,

    #[serde(rename = "algorithmWeights")]
    pub algorithm_weights: Option<AlgorithmWeights>,

    #[serde(rename = "downloadedOnlyMode")]
    pub downloaded_only_mode: Option<bool>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SortLibraryManga {
    pub reverse: Option<bool>,
    pub index: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct SortChapter {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    pub reverse: Option<bool>,
    pub index: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterFilterDownloaded {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "type")]
    pub filter_type: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterFilterUnread {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "type")]
    pub filter_type: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterFilterBookmarked {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "type")]
    pub filter_type: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterPageUrls {
    #[serde(rename = "chapterId")]
    pub chapter_id: Option<i32>,
    #[serde(rename = "chapterUrl")]
    pub chapter_url: Option<String>,
    pub urls: Option<Vec<String>>,
    pub headers: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChapterPageIndex {
    #[serde(rename = "chapterId")]
    pub chapter_id: Option<i32>,
    pub index: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PersonalReaderMode {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "readerMode")]
    pub reader_mode: i32,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PersonalPageMode {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "pageMode")]
    pub page_mode: i32,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct AutoScrollPages {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    #[serde(rename = "pageOffset")]
    pub page_offset: f64,
    #[serde(rename = "autoScroll")]
    pub auto_scroll: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Repo {
    pub name: Option<String>,
    pub website: Option<String>,
    #[serde(rename = "jsonUrl")]
    pub json_url: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct FilterScanlator {
    #[serde(rename = "mangaId")]
    pub manga_id: Option<i32>,
    pub scanlators: Option<Vec<String>>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct L10nLocale {
    #[serde(rename = "languageCode")]
    pub language_code: Option<String>,
    #[serde(rename = "countryCode")]
    pub country_code: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct CustomColorFilter {
    pub a: Option<i32>,
    pub r: Option<i32>,
    pub g: Option<i32>,
    pub b: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlayerSubtitleSettings {
    #[serde(rename = "fontSize")]
    pub font_size: Option<i32>,
    #[serde(rename = "useBold")]
    pub use_bold: Option<bool>,
    #[serde(rename = "useItalic")]
    pub use_italic: Option<bool>,
    #[serde(rename = "textColorA")]
    pub text_color_a: Option<i32>,
    #[serde(rename = "textColorR")]
    pub text_color_r: Option<i32>,
    #[serde(rename = "textColorG")]
    pub text_color_g: Option<i32>,
    #[serde(rename = "textColorB")]
    pub text_color_b: Option<i32>,
    #[serde(rename = "borderColorA")]
    pub border_color_a: Option<i32>,
    #[serde(rename = "borderColorR")]
    pub border_color_r: Option<i32>,
    #[serde(rename = "borderColorG")]
    pub border_color_g: Option<i32>,
    #[serde(rename = "borderColorB")]
    pub border_color_b: Option<i32>,
    #[serde(rename = "backgroundColorA")]
    pub background_color_a: Option<i32>,
    #[serde(rename = "backgroundColorR")]
    pub background_color_r: Option<i32>,
    #[serde(rename = "backgroundColorG")]
    pub background_color_g: Option<i32>,
    #[serde(rename = "backgroundColorB")]
    pub background_color_b: Option<i32>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct AlgorithmWeights {
    pub genre: Option<i32>,
    pub setting: Option<i32>,
    pub synopsis: Option<i32>,
    pub theme: Option<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct SettingsObj {
    pub settings: Settings,
}
