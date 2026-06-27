import { DataSourceRepository } from '../repositories/DataSourceRepository.js';

export class DataSourceService {
  static activeSources() {
    return DataSourceRepository.activeSources();
  }
}
