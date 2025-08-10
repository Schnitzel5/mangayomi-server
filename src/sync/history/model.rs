use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct History {
    #[serde(rename="_id", skip_serializing)]
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
}

#[derive(Serialize, Deserialize)]
pub struct HistoryList {
    pub histories: Vec<History>,
    pub deleted_histories: Vec<i32>,
    #[serde(rename = "resetAll")]
    pub reset_all: Option<bool>,
}
