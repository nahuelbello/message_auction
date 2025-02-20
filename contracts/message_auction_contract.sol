// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Import ReentrancyGuard to prevent reentrancy.
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MessageAuctionProportional is ReentrancyGuard {
    // State variables for the auction display
    uint256 public currentBid;
    string public currentMessage;
    address public currentBidder;

    // Founder (set in constructor)
    address public founder;
    uint256 public constant FOUNDER_FEE = 4; // 4%

    // Early Bird: las primeras 10 direcciones obtienen bonus en sus shares
    uint256 public constant EARLY_BIRD_LIMIT = 10;
    uint256 public earlyBirdCount;
    mapping(address => bool) public earlyBirdClaimed;

    // Sistema de shares para repartir recompensas de forma proporcional
    uint256 public totalShares;
    mapping(address => uint256) public sharesOf;

    // Acumulado de recompensa por share (para distribuir fondos)
    uint256 public accRewardPerShare;
    uint256 private constant SCALE = 1e12; // Factor de escala para decimales

    // Para llevar el registro de lo que ya se le asignó a cada address
    mapping(address => uint256) public rewardDebt;

    // Minimum bid increment
    uint256 public constant MIN_INCREMENT = 0.01 ether;

    // Events
    event NewBid(address indexed bidder, uint256 bid, string message);
    event Withdrawal(address indexed user, uint256 amount);

    constructor() {
        founder = msg.sender;
    }

    /**
     * @notice Permite realizar una nueva puja con un mensaje.
     * Cada puja debe superar la puja actual + MIN_INCREMENT.
     * Se descuenta un 4% de royalty para el founder y el resto se distribuye proporcionalmente
     * entre los que ya tienen shares. Si es el primer aporte de una dirección y hay cupo en los primeros 10,
     * se le asigna un bonus early bird.
     * Se permite que un mismo address puje múltiples veces.
     * @param message El mensaje que se mostrará si se convierte en el pujador actual.
     */
    function placeBid(string memory message) external payable nonReentrant {
        // Verificar que se cumple el mínimo y la condición de incremento
        if (currentBid == 0) {
            require(msg.value >= MIN_INCREMENT, "Initial bid must be >= 0.01 ETH");
        } else {
            require(msg.value >= currentBid + MIN_INCREMENT, "New bid must exceed current bid by at least 0.01 ETH");
        }

        // Calcular fee del founder y transferirlo
        uint256 fee = (msg.value * FOUNDER_FEE) / 100;
        (bool sentFee, ) = payable(founder).call{value: fee}("");
        require(sentFee, "Founder fee transfer failed");

        // Monto a distribuir entre los participantes existentes
        uint256 amountToDistribute = msg.value - fee;

        // Distribución inmediata: actualizar accRewardPerShare
        if (totalShares > 0) {
            accRewardPerShare += (amountToDistribute * SCALE) / totalShares;
        }
        
        // Para el que está pujando, calcular cuántas shares se le asignan
        // Determinar bonus factor:
        // Si es la primera vez que participa y earlyBirdCount < EARLY_BIRD_LIMIT, se le aplica bonus.
        // La fórmula: bonus = 1.5 - ((order - 1) * (0.5 / 9))
        uint256 bonusFactor; // Se expresará en formato fijo, con 1.0 = 1e12
        if (!earlyBirdClaimed[msg.sender] && earlyBirdCount < EARLY_BIRD_LIMIT) {
            // Calcular el orden (1-indexado)
            uint256 order = earlyBirdCount + 1;
            // bonus = 1.5 - (order - 1) * (0.5/9)
            // Se expresa en decimales con SCALE = 1e12: bonusFactor = ( (1.5 - (order - 1) * (0.5e12/9)) * 1e12 )
            // Para evitar decimales en Solidity, trabajamos con multiplicadores fijos:
            // 1.5x = 1500000000000, 1.0x = 1000000000000.
            uint256 bonusReduction = ((order - 1) * (500000000000)) / 9; // 0.5e12 = 500000000000, dividido en 9 pasos.
            bonusFactor = 1500000000000 - bonusReduction;
            earlyBirdClaimed[msg.sender] = true;
            earlyBirdCount++;
        } else {
            bonusFactor = 1000000000000; // 1.0x
        }

        // Calcular nuevas shares para el pujador: newShares = (msg.value * bonusFactor) / SCALE
        uint256 newShares = (msg.value * bonusFactor) / SCALE;
        sharesOf[msg.sender] += newShares;
        totalShares += newShares;

        // Actualizar rewardDebt para que el usuario no cobre recompensas generadas antes de su aporte
        rewardDebt[msg.sender] = (sharesOf[msg.sender] * accRewardPerShare) / SCALE;

        // Actualizar el estado de la subasta
        currentBid = msg.value;
        currentMessage = message;
        currentBidder = msg.sender;

        emit NewBid(msg.sender, msg.value, message);
    }

    /**
     * @notice Permite retirar las recompensas acumuladas (ingresos pasivos) de un usuario.
     * @dev Calcula la recompensa pendiente en función de las shares y el accRewardPerShare.
     */
    function withdraw() external nonReentrant {
        uint256 userShares = sharesOf[msg.sender];
        require(userShares > 0, "No shares");

        uint256 accumulatedReward = (userShares * accRewardPerShare) / SCALE;
        uint256 pending = accumulatedReward - rewardDebt[msg.sender];
        require(pending > 0, "No funds to withdraw");

        // Actualizar rewardDebt para el usuario
        rewardDebt[msg.sender] = accumulatedReward;
        
        (bool sent, ) = payable(msg.sender).call{value: pending}("");
        require(sent, "Withdrawal failed");

        emit Withdrawal(msg.sender, pending);
    }

    /**
     * @notice Consulta el saldo de recompensa pendiente de una dirección.
     */
    function pendingReward(address user) external view returns (uint256) {
        uint256 userShares = sharesOf[user];
        if (userShares == 0) return 0;
        uint256 accumulatedReward = (userShares * accRewardPerShare) / SCALE;
        return accumulatedReward - rewardDebt[user];
    }

    // Fallback y receive para aceptar Ether (en caso de que sea necesario)
    receive() external payable {}
    fallback() external payable {}
}