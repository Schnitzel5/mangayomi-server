export interface SettingsModel {
    id: number
    updatedAt: number
    displayType: number
    libraryFilterMangasDownloadType: number
    libraryFilterMangasUnreadType: number
    libraryFilterMangasStartedType: number
    libraryFilterMangasBookMarkedType: number
    libraryShowCategoryTabs: boolean
    libraryDownloadedChapters: boolean
    libraryShowLanguage: boolean
    libraryShowNumbersOfItems: boolean
    libraryShowContinueReadingButton: boolean
    libraryLocalSource: boolean
    sortLibraryManga: SortLibraryManga
    sortChapterList: SortChapterList[]
    chapterFilterDownloadedList: ChapterFilterDownloadedList[]
    chapterFilterUnreadList: ChapterFilterUnreadList[]
    chapterFilterBookmarkedList: ChapterFilterBookmarkedList[]
    flexColorSchemeBlendLevel: number
    dateFormat: string
    relativeTimesTamps: number
    flexSchemeColorIndex: number
    themeIsDark: boolean
    followSystemTheme: boolean
    incognitoMode: boolean
    chapterPageUrlsList: ChapterPageUrlsList[]
    showPagesNumber: boolean
    chapterPageIndexList: ChapterPageIndexList[]
    userAgent: string
    defaultReaderMode: number
    personalReaderModeList: PersonalReaderModeList[]
    animatePageTransitions: boolean
    doubleTapAnimationSpeed: number
    onlyIncludePinnedSources: boolean
    pureBlackDarkMode: boolean
    downloadOnlyOnWifi: boolean
    saveAsCBZArchive: boolean
    concurrentDownloads: number
    downloadLocation: string
    filterScanlatorList: FilterScanlatorList[]
    autoExtensionsUpdates: boolean
    cropBorders: boolean
    locale: L10nLocale
    defaultSubtitleLang: L10nLocale
    animeDisplayType: number
    libraryFilterAnimeDownloadType: number
    libraryFilterAnimeUnreadType: number
    libraryFilterAnimeStartedType: number
    libraryFilterAnimeBookMarkedType: number
    animeLibraryShowCategoryTabs: boolean
    animeLibraryDownloadedChapters: boolean
    animeLibraryShowLanguage: boolean
    animeLibraryShowNumbersOfItems: boolean
    animeLibraryShowContinueReadingButton: boolean
    animeLibraryLocalSource: boolean
    sortLibraryAnime: SortLibraryManga
    pagePreloadAmount: number
    checkForAppUpdates: boolean
    checkForExtensionUpdates: boolean
    scaleType: number
    backgroundColor: number
    personalPageModeList: PersonalPageModeList[]
    startDatebackup: number
    backupFrequency: number
    backupListOptions: number[]
    autoBackupLocation: string
    usePageTapZones: boolean
    autoScrollPages: AutoScrollPages[]
    markEpisodeAsSeenType: number
    defaultSkipIntroLength: number
    defaultDoubleTapToSkipLength: number
    defaultPlayBackSpeed: number
    fullScreenPlayer: boolean
    updateProgressAfterReading: boolean
    enableAniSkip: boolean
    enableAutoSkip: boolean
    aniSkipTimeoutLength: number
    customDns: string
    btServerAddress: string
    btServerPort: number
    fullScreenReader: boolean
    customColorFilter: CustomColorFilter
    enableCustomColorFilter: boolean
    colorFilterBlendMode: number
    playerSubtitleSettings: PlayerSubtitleSettings
    mangaHomeDisplayType: number
    appFontFamily: string
    mangaGridSize: number
    animeGridSize: number
    novelGridSize: number
    mangaExtensionsRepo: Repo[]
    animeExtensionsRepo: Repo[]
    novelExtensionsRepo: Repo[]
    androidProxyServer: string
    disableSectionType: number
    useLibass: boolean
    hwdecMode: string
    enableHardwareAcceleration: boolean
    libraryFilterNovelDownloadType: number
    libraryFilterNovelUnreadType: number
    libraryFilterNovelStartedType: number
    libraryFilterNovelBookMarkedType: number
    novelLibraryShowCategoryTabs: boolean
    novelLibraryDownloadedChapters: boolean
    novelLibraryShowLanguage: boolean
    novelLibraryShowNumbersOfItems: boolean
    novelLibraryShowContinueReadingButton: boolean
    novelLibraryLocalSource: boolean
    sortLibraryNovel: SortLibraryManga
    novelDisplayType: number
    novelFontSize: number
    novelTextAlign: number
    novelReaderTheme: string
    novelReaderTextColor: string
    novelReaderPadding: number
    novelReaderLineHeight: number
    novelShowScrollPercentage: boolean
    novelRemoveExtraParagraphSpacing: boolean
    novelTapToScroll: boolean
    navigationOrder: string[]
    hideItems: string[]
    clearChapterCacheOnAppLaunch: boolean
    lastTrackerLibraryLocation: string
    mergeLibraryNavMobile: boolean
    enableDiscordRpc: boolean
    hideDiscordRpcInIncognito: boolean
    rpcShowReadingWatchingProgress: boolean
    rpcShowTitle: boolean
    rpcShowCoverImage: boolean
    useMpvConfig: boolean
    debandingType: number
    enableGpuNext: boolean
    useYUV420P: boolean
    audioPreferredLanguages: string
    enableAudioPitchCorrection: boolean
    audioChannels: number
    volumeBoostCap: number
    algorithmWeights: AlgorithmWeights
    downloadedOnlyMode: boolean
    localFolders: string[]
}

export interface AutoScrollPages {
    mangaId: number
    pageOffset: number
    autoScroll: boolean
}

export interface L10nLocale {
    languageCode: string
    countryCode: string
}

export interface SortLibraryManga {
    reverse: boolean
    index: number
}

export interface SortChapterList {
    mangaId: number
    reverse: boolean
    index: number
}

export interface ChapterFilterDownloadedList {
    mangaId: number
    type: number
}

export interface ChapterFilterUnreadList {
    mangaId: number
    type: number
}

export interface ChapterFilterBookmarkedList {
    mangaId: number
    type: number
}

export interface ChapterPageUrlsList {
    chapterId: number
    chapterUrl: string
    urls?: string[]
    headers: string[]
}

export interface ChapterPageIndexList {
    chapterId: number
    index: number
}

export interface PersonalReaderModeList {
    mangaId: number
    readerMode: number
}

export interface FilterScanlatorList {
    mangaId: number
    scanlators: string[]
}

export interface PersonalPageModeList {
    mangaId: number
    pageMode: number
}

export interface CustomColorFilter {
    a: number
    r: number
    g: number
    b: number
}

export interface PlayerSubtitleSettings {
    fontSize: number
    useBold: boolean
    useItalic: boolean
    textColorA: number
    textColorR: number
    textColorG: number
    textColorB: number
    borderColorA: number
    borderColorR: number
    borderColorG: number
    borderColorB: number
    backgroundColorA: number
    backgroundColorR: number
    backgroundColorG: number
    backgroundColorB: number
}

export interface Repo {
    name: string
    website: string
    jsonUrl: string
    hidden: boolean
}

export interface AlgorithmWeights {
    genre: number
    setting: number
    synopsis: number
    theme: number
}
