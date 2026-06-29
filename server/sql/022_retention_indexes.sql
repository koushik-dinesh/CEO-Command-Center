-- Phase 13–14: index to support uploaded_files retention pruning.

ALTER TABLE uploaded_files
  ADD KEY uploaded_files_createdAt_idx (createdAt);
