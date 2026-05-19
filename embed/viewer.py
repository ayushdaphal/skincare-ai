import streamlit as st
import chromadb
import pandas as pd

client = chromadb.PersistentClient(path="./chroma_persistent_storage")
collection = client.get_collection("knowledge_base")

st.title("ChromaDB Viewer")

st.write("Total documents:", collection.count())

data = collection.peek(limit=100)

df = pd.DataFrame({
    "id": data["ids"],
    "metadata": data["metadatas"],
    "document": [doc[:300] for doc in data["documents"]]
})

st.dataframe(df)