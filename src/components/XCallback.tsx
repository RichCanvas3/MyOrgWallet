import { useEffect } from 'react';
import axios from 'axios';


const XCallback: React.FC = () => {
  useEffect(() => {

    console.info("...... x callback was called ..........")
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    const exchangeCodeForToken = async (c: string) => {
        
        const params = new URLSearchParams();
        params.append('code', c);
      
        try {
          window.opener?.postMessage(
            { type: 'x_auth', code: c },
            '*'
            );
    
            window.close();

        } catch (error) {
          console.error('Error exchanging code for token:', error);
        }
      };

    var c = code ? code : ''
    exchangeCodeForToken(c)


      


    
  }, []);

  return <div>Loading...</div>;
};

export default XCallback;