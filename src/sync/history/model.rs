use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct History {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    pub date: String,
    #[serde(rename = "mangaId")]
    pub manga_id: i32,
    #[serde(rename = "chapterId")]
    pub chapter_id: i32,
    #[serde(rename = "itemType")]
    pub item_type: i32,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
    #[serde(rename = "readingTimeSeconds")]
    pub reading_time_seconds: Option<i32>,
}

#[derive(Serialize, Deserialize)]
pub struct HistoryList {
    pub histories: Vec<History>,
    pub deleted_histories: Vec<i32>,
    #[serde(rename = "resetAll")]
    pub reset_all: Option<bool>,
}

impl crate::sync::common::Model for History {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}

#[cfg(test)]
mod tests {
    use super::History;
    use mongodb::bson::{doc, from_document, to_document};

    #[test]
    fn preserves_current_upstream_history_fields() {
        let input = doc! {
            "id": 1,
            "date": "2026-08-15T00:00:00Z",
            "mangaId": 2,
            "chapterId": 3,
            "itemType": 0,
            "updatedAt": 1_i64,
            "readingTimeSeconds": 120,
        };

        let history: History = from_document(input.clone()).unwrap();
        let output = to_document(&history).unwrap();

        assert_eq!(
            output.get("readingTimeSeconds"),
            input.get("readingTimeSeconds")
        );
    }
}
