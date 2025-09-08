import React from "react";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Tooltip,
  Divider,
  Avatar,
  Badge,
} from "@mui/material";
import {
  CheckCircle as BadgeCheckIcon,
  Cancel as BadgeXIcon,
  Person as UserIcon,
  Person as PersonIcon,
  AssignmentInd as IdCardIcon,
  Description as FileIcon,
  Bookmark as BookmarkIcon,
  Lock as LockIcon,
  VerifiedUser as ShieldCheckIcon,
  School as AwardIcon,
  EmojiEvents as TrophyIcon,
  InsertDriveFile as FileCheckIcon,
  HourglassEmpty as HourglassIcon,
  CalendarToday as CalendarCheckIcon,
  Business as BusinessIcon,
  Language as LanguageIcon,
  ShoppingCart as ShoppingCartIcon,
  Public as PublicIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  AccountBalance as AccountBalanceIcon,
  CreditCard as CreditCardIcon,
  Security as SecurityIcon,
  Assignment as AssignmentIcon,
  Share as ShareIcon,
  Star as StarIcon,
} from "@mui/icons-material";
import { Attestation } from "../models/Attestation";

interface AttestationCardProps {
  attestation: Attestation;
  selected?: boolean;
  onSelect?: () => void;
  hoverable?: boolean;
}

// Icon mapping based on entityId patterns
const getEntityIcon = (entityId: string, category?: string): React.ElementType => {
  const lowerEntityId = entityId.toLowerCase();
  const lowerCategory = category?.toLowerCase() || '';



  // Specific entityId pattern matching based on actual attestation data
  if (lowerEntityId === 'indiv(indiv)') {
    return PersonIcon;
  }

  if (lowerEntityId === 'account(indiv)') {
    return AccountBalanceIcon;
  }

  if (lowerEntityId === 'account-org(org)') {
    return AccountBalanceIcon;
  }

  if (lowerEntityId === 'account-indiv(org)') {
    return AccountBalanceIcon;
  }

  if (lowerEntityId === 'org(org)') {
    return BusinessIcon;
  }

  if (lowerEntityId === 'domain(org)') {
    return LanguageIcon;
  }

  if (lowerEntityId === 'ens(org)') {
    return LanguageIcon;
  }

  if (lowerEntityId === 'website(org)') {
    return PublicIcon;
  }

  if (lowerEntityId === 'email(org)') {
    return EmailIcon;
  }

  if (lowerEntityId === 'email(indiv)') {
    return EmailIcon;
  }

  if (lowerEntityId === 'social(indiv)') {
    return ShareIcon;
  }

  if (lowerEntityId === 'linkedin(indiv)') {
    return ShareIcon;
  }

  // Fallback to category-based mapping if no specific entityId match

  // Default fallback - try category-based mapping

  // Category-based fallback mapping
  const categoryIconMap: Record<string, React.ElementType> = {
    leadership: PersonIcon,
    identity: IdCardIcon,
    finance: AccountBalanceIcon,
    compliance: ShieldCheckIcon,
    reputation: StarIcon,
    domain: LanguageIcon,
    website: PublicIcon,
    social: ShareIcon,
    email: EmailIcon,
    phone: PhoneIcon,
    address: LocationOnIcon,
    account: AccountBalanceIcon,
    credit: CreditCardIcon,
    insurance: SecurityIcon,
    license: AssignmentIcon,
    registration: FileIcon,
    audit: ShieldCheckIcon,
    certification: AssignmentIcon,
    security: SecurityIcon,
    endorsement: StarIcon,
    review: StarIcon,
    rating: StarIcon,
    testimonial: StarIcon,
    accreditation: AssignmentIcon,
  };

  const categoryIcon = categoryIconMap[lowerCategory] || UserIcon;
  return categoryIcon;
};

const badgeDescriptions: Record<string, string> = {
  verified: "Fully confirmed",
  proven: "Strong evidence",
  pending: "Awaiting verification",
};

export function AttestationCard({
  attestation,
  selected = false,
  onSelect,
  hoverable = false,
}: AttestationCardProps) {
  const { entityId, displayName, category, isValidated } = attestation;

  // Clean up entityId for display by removing (org), (indiv), and (agent) suffixes
  const cleanEntityId = (entityId || '').replace(/\(org\)|\(indiv\)|\(agent\)/g, '');

  // Parse domain name for AIAgent attestations
  const isAIAgentWithDomain = attestation.class === 'agent' && displayName && displayName.includes('.');
  const agentName = isAIAgentWithDomain ? displayName.split('.')[0] : null;
  const orgDomain = isAIAgentWithDomain ? displayName.split('.').slice(1).join('.') : null;

  // Icon component based on entityId
  const Icon = getEntityIcon(entityId || '', category);

  // Check if this is a MetaMask Card attestation
  const isMetaMaskCard = displayName === "MetaMask Card";

  // Category color mapping
  const getCategoryColor = (category: string): string => {
    const colorMap: Record<string, string> = {
      wallet: '#ff5722',      // Deep Orange
      leadership: '#1976d2',      // Blue
      identity: '#388e3c',        // Green
      finance: '#f57c00',         // Orange
      compliance: '#d32f2f',      // Red
      reputation: '#7b1fa2',      // Purple
      domain: '#0288d1',          // Light Blue
      website: '#009688',         // Teal
      social: '#ff9800',          // Orange
      email: '#795548',           // Brown
      phone: '#607d8b',           // Blue Grey
      address: '#9e9e9e',         // Grey
      account: '#4caf50',         // Green
      credit: '#ff5722',          // Deep Orange
      insurance: '#3f51b5',       // Indigo
      license: '#673ab7',         // Deep Purple
      registration: '#e91e63',    // Pink
      audit: '#00bcd4',           // Cyan
      certification: '#8bc34a',   // Light Green
      security: '#ffc107',        // Amber
      endorsement: '#9c27b0',     // Purple
      review: '#ff6f00',          // Amber
      rating: '#4db6ac',          // Teal
      testimonial: '#81c784',     // Light Green
      accreditation: '#64b5f6',   // Light Blue
      default: '#757575',         // Grey
    };
    return colorMap[category?.toLowerCase() || 'default'] || colorMap.default;
  };

  const categoryColor = getCategoryColor(category || 'default');

  // Badge state
  let badgeIcon = <BadgeCheckIcon fontSize="small" color="success" />;
  let description = badgeDescriptions.verified;
  let badgeColor: "success" | "info" | "disabled" = "success";

  if (isValidated) {
    badgeIcon = <BadgeCheckIcon fontSize="small" color="info" />;
    description = badgeDescriptions.proven;
    badgeColor = "info";
  }

  return (
    <Card
      variant={selected ? "outlined" : "elevation"}
      sx={{
        width: 180,
        height: 120,
        borderColor: selected ? categoryColor : undefined,
        borderWidth: selected ? 2 : 1,
        bgcolor: selected ? `${categoryColor}08` : "background.paper",
        boxShadow: selected ? 4 : 2,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        borderRadius: 2,
        position: 'relative',
        overflow: 'visible',
        ...(isMetaMaskCard && {
          background: `url('/metamaskfox.png') no-repeat bottom right`,
          backgroundSize: '78px 78px',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.4)',
            borderRadius: 2,
            zIndex: 0,
          },
        }),
        ...(hoverable && {
          "&:hover": {
            bgcolor: isMetaMaskCard ? 'rgba(255, 255, 255, 0.95)' : `${categoryColor}0a`,
            borderColor: categoryColor,
            boxShadow: `0 8px 25px ${categoryColor}40`,
            transform: "translateY(-4px)",
          },
        }),
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 0, height: '100%' }}>
        <CardContent sx={{
          display: "flex",
          flexDirection: "column",
          p: 0,
          height: '100%',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Category accent line */}
          <Box
            sx={{
              height: 3,
              bgcolor: categoryColor,
              borderRadius: '2px 2px 0 0',
            }}
          />

          {/* Main content */}
          <Box sx={{ p: 1.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Header with icon and badge */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
                <Avatar
                  sx={{
                    bgcolor: isMetaMaskCard ? 'rgba(0, 0, 0, 0.1)' : `${categoryColor}20`,
                    color: isMetaMaskCard ? '#333' : categoryColor,
                    width: 32,
                    height: 32,
                    fontSize: '0.875rem',
                  }}
                >
                  <Icon />
                </Avatar>
                <Typography
                  variant="subtitle2"
                  noWrap
                  sx={{
                    ml: 1,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    color: isMetaMaskCard ? '#333' : 'text.primary',
                  }}
                >
                  {cleanEntityId}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center" }}>
                {badgeIcon}
              </Box>
            </Box>

            {/* Description */}
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {isAIAgentWithDomain ? (
                <Box sx={{ width: '100%' }}>
                  <Typography
                    variant="body2"
                    color={isMetaMaskCard ? '#333' : 'text.secondary'}
                    sx={{
                      lineHeight: 1.2,
                      fontSize: '0.75rem',
                    }}
                  >
                    <strong>name:</strong> {agentName}
                  </Typography>
                  <Typography
                    variant="body2"
                    color={isMetaMaskCard ? '#333' : 'text.secondary'}
                    sx={{
                      lineHeight: 1.2,
                      fontSize: '0.75rem',
                    }}
                  >
                    <strong>domain:</strong> {orgDomain}
                  </Typography>
                </Box>
              ) : (
                <Typography
                  variant="body2"
                  color={isMetaMaskCard ? '#333' : 'text.secondary'}
                  sx={{
                    lineHeight: 1.3,
                    fontSize: '0.75rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayName}
                </Typography>
              )}
            </Box>


          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

export default AttestationCard;
