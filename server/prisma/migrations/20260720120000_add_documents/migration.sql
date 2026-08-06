-- CreateTable
CREATE TABLE "tblDocuments" (
    "Document_id" VARCHAR(50) NOT NULL,
    "Entity_Type" VARCHAR(50) NOT NULL,
    "Entity_Id" VARCHAR(50) NOT NULL,
    "Document_Type" VARCHAR(100),
    "File_Name" VARCHAR(255) NOT NULL,
    "Storage_Key" VARCHAR(500) NOT NULL,
    "Mime_Type" VARCHAR(100),
    "File_Size" INTEGER,
    "Uploaded_By" VARCHAR(50),
    "Created_On" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "Int_Status" INTEGER DEFAULT 1,

    CONSTRAINT "tblDocuments_pkey" PRIMARY KEY ("Document_id")
);

-- CreateIndex
CREATE INDEX "tblDocuments_Entity_Type_Entity_Id_idx" ON "tblDocuments"("Entity_Type", "Entity_Id");
