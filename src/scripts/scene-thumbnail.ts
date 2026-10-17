/** Refresh once after import and asset overrides. */
export async function refreshSceneThumbnail(scene: Scene): Promise<void> {
  const result=await scene.createThumbnail();
  if(!result?.thumb?.trim())throw Error("Foundry returned an empty Scene thumbnail.");
  const saved=await scene.update({thumb:result.thumb});
  // Foundry saves a thumbnail file and adds a cache-busting query to the prepared URL.
  // Verify native acceptance and stored source data, not equality with the generated image.
  const stored=scene.toObject().thumb;
  if(!stored?.trim()||(!saved&&stored!==result.thumb))throw Error("Foundry did not save the Scene thumbnail.");
}
