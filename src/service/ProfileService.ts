import Dexie from 'dexie';
import {EventEmitter} from "./EventEmitter";
import FileDataService from './FileDataService';
import { ChatMessage } from '../models/ChatCompletion';

export interface Profile {
    id: string; // Required for Dexie primary key
  companyName: string | undefined;
  fullName: string | undefined;
  website: string | undefined;
  email: string | undefined;
}

export interface ProfileChangeEvent {
  profile?: Profile, // not set on delete
}


class ProfileDB extends Dexie {
  profileData!: Dexie.Table<Profile>;

  constructor() {
    super("profileDB");
    this.version(1).stores({
      profileData: 'id', // Single entry with fixed key
    });
  }
}

const db = new ProfileDB();


class ProfileService {

  static async getProfile(): Promise<Profile | undefined> {
    const data = await db.profileData.get("prof");
    return data;
  }

  static async saveProfile(data: Profile): Promise<void> {
    data.id = "prof"
    await db.profileData.put(data);

    let event: ProfileChangeEvent = { profile: data};
    profileEmitter.emit('profileChangeEvent', event);
  }


}

export const profileEmitter = new EventEmitter<ProfileChangeEvent>();
export default ProfileService;
