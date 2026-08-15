use crate::sync::common::Model;
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Category {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    pub name: String,
    #[serde(rename = "forItemType")]
    pub for_item_type: i32,
    pub pos: Option<i32>,
    pub hide: Option<bool>,
    #[serde(rename = "shouldUpdate")]
    pub should_update: Option<bool>,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

impl Model for Category {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Manga {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    pub name: String,
    pub link: String,
    #[serde(rename = "imageUrl")]
    pub image_url: String,
    pub description: Option<String>,
    pub author: Option<String>,
    pub artist: Option<String>,
    pub status: i32,
    pub favorite: bool,
    pub source: String,
    #[serde(rename = "sourceId")]
    pub source_id: Option<i64>,
    pub lang: String,
    #[serde(rename = "dateAdded")]
    pub date_added: Option<i64>,
    #[serde(rename = "lastUpdate")]
    pub last_update: Option<i64>,
    #[serde(rename = "lastRead")]
    pub last_read: Option<i64>,
    #[serde(rename = "isLocalArchive")]
    pub is_local_archive: Option<bool>,
    #[serde(rename = "customCoverImage")]
    pub custom_cover_image: Option<Vec<u8>>,
    #[serde(rename = "customCoverFromTracker")]
    pub custom_cover_from_tracker: Option<String>,
    #[serde(rename = "smartUpdateDays")]
    pub smart_update_days: Option<i32>,
    #[serde(rename = "itemType")]
    pub item_type: i32,
    pub genre: Option<Vec<String>>,
    pub categories: Option<Vec<i32>>,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

impl Model for Manga {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Chapter {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    pub name: String,
    pub url: Option<String>,
    #[serde(rename = "dateUpload")]
    pub date_upload: Option<String>,
    pub scanlator: Option<String>,
    #[serde(rename = "isBookmarked")]
    pub is_bookmarked: bool,
    #[serde(rename = "isRead")]
    pub is_read: bool,
    #[serde(rename = "lastPageRead")]
    pub last_page_read: Option<String>,
    #[serde(rename = "archivePath")]
    pub archive_path: Option<String>,
    #[serde(rename = "isFiller")]
    pub is_filler: Option<bool>,
    #[serde(rename = "thumbnailUrl")]
    pub thumbnail_url: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "downloadSize")]
    pub download_size: Option<String>,
    pub duration: Option<String>,
    #[serde(rename = "mangaId")]
    pub manga_id: i32,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

impl Model for Chapter {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Track {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    #[serde(rename = "libraryId")]
    pub library_id: Option<i32>,
    #[serde(rename = "mediaId")]
    pub media_id: i32,
    #[serde(rename = "mangaId")]
    pub manga_id: i32,
    pub score: Option<i32>,
    #[serde(rename = "startedReadingDate")]
    pub started_reading_date: Option<i64>,
    #[serde(rename = "finishedReadingDate")]
    pub finished_reading_date: Option<i64>,
    #[serde(rename = "lastChapterRead")]
    pub last_chapter_read: Option<i32>,
    pub status: Option<i32>,
    #[serde(rename = "syncId")]
    pub sync_id: i32,
    pub title: String,
    #[serde(rename = "totalChapter")]
    pub total_chapter: Option<i32>,
    #[serde(rename = "trackingUrl")]
    pub tracking_url: String,
    #[serde(rename = "isManga")]
    pub is_manga: Option<bool>,
    #[serde(rename = "itemType")]
    pub item_type: i32,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

impl Model for Track {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}

#[derive(Serialize, Deserialize)]
pub struct MangaList {
    pub categories: Vec<Category>,
    pub deleted_categories: Vec<i32>,
    pub manga: Vec<Manga>,
    pub deleted_manga: Vec<i32>,
    pub chapters: Vec<Chapter>,
    pub deleted_chapters: Vec<i32>,
    pub tracks: Vec<Track>,
    pub deleted_tracks: Vec<i32>,
    #[serde(rename = "resetAll")]
    pub reset_all: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::{Chapter, Manga};
    use mongodb::bson::{doc, from_document, to_document};

    #[test]
    fn preserves_current_upstream_manga_and_chapter_fields() {
        let manga_input = doc! {
            "id": 1,
            "name": "Manga",
            "link": "/manga",
            "imageUrl": "https://example.com/cover.jpg",
            "status": 0,
            "favorite": true,
            "source": "Example",
            "lang": "en",
            "itemType": 0,
            "updatedAt": 1_i64,
            "customCoverImage": vec![1_i32, 2_i32, 3_i32],
            "smartUpdateDays": 7,
        };
        let manga: Manga = from_document(manga_input.clone()).unwrap();
        let manga_output = to_document(&manga).unwrap();
        for key in ["customCoverImage", "smartUpdateDays"] {
            assert_eq!(manga_output.get(key), manga_input.get(key), "field {key}");
        }

        let chapter_input = doc! {
            "id": 2,
            "name": "Chapter",
            "isBookmarked": false,
            "isRead": false,
            "mangaId": 1,
            "updatedAt": 1_i64,
            "isFiller": true,
            "thumbnailUrl": "https://example.com/chapter.jpg",
            "description": "Synopsis",
            "downloadSize": "42 MB",
            "duration": "24:00",
        };
        let chapter: Chapter = from_document(chapter_input.clone()).unwrap();
        let chapter_output = to_document(&chapter).unwrap();
        for key in [
            "isFiller",
            "thumbnailUrl",
            "description",
            "downloadSize",
            "duration",
        ] {
            assert_eq!(
                chapter_output.get(key),
                chapter_input.get(key),
                "field {key}"
            );
        }
    }
}
