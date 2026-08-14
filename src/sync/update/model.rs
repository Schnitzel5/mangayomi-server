use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Update {
    #[serde(rename = "_id", skip_serializing)]
    pub oid: Option<ObjectId>,
    pub id: i32,
    #[serde(rename = "mangaId")]
    pub manga_id: i32,
    #[serde(rename = "chapterName")]
    pub chapter_name: String,
    pub date: String,
    #[serde(skip_serializing)]
    pub user: Option<ObjectId>,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateList {
    pub updates: Vec<Update>,
    pub deleted_updates: Vec<i32>,
    #[serde(rename = "resetAll")]
    pub reset_all: Option<bool>,
}

impl crate::sync::common::Model for Update {
    fn get_id(&self) -> i32 {
        self.id
    }
    fn get_updated_at(&self) -> i64 {
        self.updated_at
    }
}
