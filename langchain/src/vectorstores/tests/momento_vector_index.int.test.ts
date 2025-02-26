/* eslint-disable no-process-env */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { describe, expect } from "@jest/globals";
import { faker } from "@faker-js/faker";
import {
  PreviewVectorIndexClient,
  VectorIndexConfigurations,
  CredentialProvider,
} from "@gomomento/sdk";
import * as uuid from "uuid";
import { Document } from "../../document.js";
import { OpenAIEmbeddings } from "../../embeddings/openai.js";
import { MomentoVectorIndex } from "../momento_vector_index.js";
import { sleep } from "../../util/time.js";

async function withVectorStore(
  block: (vectorStore: MomentoVectorIndex) => Promise<void>
): Promise<void> {
  const indexName = uuid.v4();
  const vectorStore = new MomentoVectorIndex(new OpenAIEmbeddings(), {
    client: new PreviewVectorIndexClient({
      configuration: VectorIndexConfigurations.Laptop.latest(),
      credentialProvider: CredentialProvider.fromEnvironmentVariable({
        environmentVariableName: "MOMENTO_API_KEY",
      }),
    }),
    indexName,
  });
  try {
    await block(vectorStore);
  } finally {
    await vectorStore.getClient().deleteIndex(indexName);
  }
}

describe.skip("MomentoVectorIndex", () => {
  it("stores user-provided ids", async () => {
    await withVectorStore(async (vectorStore: MomentoVectorIndex) => {
      const pageContent = faker.lorem.sentence(5);
      const documentId = "foo";

      await vectorStore.addDocuments([{ pageContent, metadata: {} }], {
        ids: [documentId],
      });
      await sleep();
      const results = await vectorStore.similaritySearch(pageContent, 1);
      expect(results).toEqual([new Document({ metadata: {}, pageContent })]);
    });
  });

  it("stores uuids when no ids are provided", async () => {
    await withVectorStore(async (vectorStore: MomentoVectorIndex) => {
      const pageContent = faker.lorem.sentence(5);

      await vectorStore.addDocuments([{ pageContent, metadata: {} }]);
      await sleep();
      const results = await vectorStore.similaritySearch(pageContent, 1);

      expect(results).toEqual([new Document({ metadata: {}, pageContent })]);
    });
  });

  it("stores metadata", async () => {
    await withVectorStore(async (vectorStore: MomentoVectorIndex) => {
      const pageContent = faker.lorem.sentence(5);
      const metadata = { foo: "bar" };

      await vectorStore.addDocuments([{ pageContent, metadata }]);
      await sleep();
      const results = await vectorStore.similaritySearch(pageContent, 1);

      expect(results).toEqual([new Document({ metadata, pageContent })]);
    });
  });

  it("fails with fromTexts when texts length doesn't match metadatas length", async () => {
    const pageContent = faker.lorem.sentence(5);
    const metadata = { foo: "bar" };

    await expect(
      MomentoVectorIndex.fromTexts(
        [pageContent],
        [metadata, metadata],
        new OpenAIEmbeddings(),
        {
          client: new PreviewVectorIndexClient({
            configuration: VectorIndexConfigurations.Laptop.latest(),
            credentialProvider: CredentialProvider.fromEnvironmentVariable({
              environmentVariableName: "MOMENTO_API_KEY",
            }),
          }),
        }
      )
    ).rejects.toThrow(
      "Number of texts (1) does not equal number of metadatas (2)"
    );
  });

  it("deletes documents by id", async () => {
    await withVectorStore(async (vectorStore: MomentoVectorIndex) => {
      const pageContent1 = faker.lorem.sentence(5);
      const documentId1 = "pageContent1";

      const pageContent2 = faker.lorem.sentence(5);
      const documentId2 = "pageContent2";

      await vectorStore.addDocuments(
        [
          { pageContent: pageContent1, metadata: {} },
          { pageContent: pageContent2, metadata: {} },
        ],
        {
          ids: [documentId1, documentId2],
        }
      );

      await sleep();

      const searchResults = await vectorStore.similaritySearch(pageContent1, 1);
      expect(searchResults).toEqual([
        new Document({ metadata: {}, pageContent: pageContent1 }),
      ]);

      await vectorStore.delete({ ids: [documentId1] });
      await sleep();

      const results = await vectorStore.similaritySearch(pageContent1, 2);
      expect(results).toEqual([
        new Document({ metadata: {}, pageContent: pageContent2 }),
      ]);
    });
  });
});
