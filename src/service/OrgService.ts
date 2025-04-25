
import {OPENAI_API_KEY} from "../config";
import {CustomError} from "./CustomError";



export class OrgService {

  static abortController: AbortController | null = null;



  static async getOrgWithCompanyName(name: string, state: string): Promise<any> {
    let endpoint = "http://127.0.0.1:8501/creds/good-standing/company?company=" + name + "&state=" + state;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from company name: ", res)
    return JSON.stringify(res);
  }


  static async getOrgWithEmail(email: string): Promise<any> {
    let endpoint = "http://127.0.0.1:8501/creds/good-standing/email?email=" + email;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from email: ", res)
    return JSON.stringify(res);
  }


  static async checkDomain(domain: string): Promise<any> {
    let endpoint = "http://127.0.0.1:8501/creds/good-standing/domain?domain=" + domain;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    console.info("...... got response from domain: ", res)
    return JSON.stringify(res);
  }

  static async checkWebsite(website: string): Promise<any> {
    let endpoint = "http://127.0.0.1:8501/creds/good-standing/website?website=" + website;
    let headers = {
      "Content-Type": "application/json"
    };

    
    const response = await fetch(endpoint, {
      method: "GET",
      headers: headers
    });

    if (!response.ok) {
      const err = await response.json();
      throw new CustomError(err.error.message, err);
    }

    var res = await response.json()
    return JSON.stringify(res);
  }
}

