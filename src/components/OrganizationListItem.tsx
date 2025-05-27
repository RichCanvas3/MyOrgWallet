import * as React from 'react';
import {useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ChatBubbleLeftIcon, CheckIcon, PencilSquareIcon, TrashIcon, XMarkIcon, BuildingOfficeIcon} from "@heroicons/react/24/outline";
import AttestationService from "../service/AttestationService";
import {Organization} from "../models/Organization"
import {iconProps} from "../svg";
import {MAX_TITLE_LENGTH} from "../constants/appConstants";

interface OrganizationListItemProps {
  organization: Organization;
  isSelected: boolean;
  onSelectOrganization: (address: string) => void;
}


const OrganizationListItem: React.FC<OrganizationListItemProps> = ({
                                                                     organization,
                                                                     isSelected,
                                                                     onSelectOrganization,
                                                                   }) => {
  const [editedName, setEditedName] = useState(organization.name);
  const navigate = useNavigate();
  const acceptButtonRef = useRef<HTMLButtonElement | null>(null);


  const selectOrganization = () => {
    onSelectOrganization(organization.orgDid);
  };


  return (
    <li key={organization.orgDid} className="organization-list-item">
      <button
        onClick={() => selectOrganization()}
        type="button"
      >
        {/* <div className="organization-card"> */}
          <div className="organization-header">
            <BuildingOfficeIcon className="organization-icon" stroke="grey" />
            <span className="organization-name">{organization.name}</span>
          </div>
          <div className="organization-date">{organization.issuedate}</div>
        {/* </div> */}
      </button>
    </li>
  );

}

export default OrganizationListItem;